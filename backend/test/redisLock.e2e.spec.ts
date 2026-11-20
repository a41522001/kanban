import { Test } from '@nestjs/testing';
import { Logger, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { envSchema } from '../src/config/env';
import { configNamespaces } from '../src/config';
import { RedisModule } from '../src/infrastructure/redis/redis.module';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { RedisLockService } from '../src/infrastructure/redis/redisLock.service';
import { LOG_EVENTS } from '../src/common/constants/logEvents';

/**
 * RedisLockService against a real Redis (Board spec §8.2): SET NX PX acquire and
 * the compare-and-delete Lua release, including the expired-then-taken race.
 */
describe('RedisLockService (e2e)', () => {
  let app: INestApplication;
  let redis: RedisService;
  let lock: RedisLockService;
  const usedKeys: string[] = [];

  const newKey = () => {
    const key = `lock:test:${randomUUID()}`;
    usedKeys.push(key);
    return key;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.e2e',
          validate: (config) => envSchema.parse(config),
          load: configNamespaces,
        }),
        RedisModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    redis = app.get(RedisService);
    lock = app.get(RedisLockService);
  });

  afterAll(async () => {
    if (usedKeys.length > 0) {
      await redis.getClient().del(usedKeys);
    }
    await app.close();
  });

  describe('acquire', () => {
    it('key 不存在時取得鎖，值為 owner 且帶 TTL', async () => {
      const key = newKey();

      await expect(lock.acquire(key, 'owner-a', 30000)).resolves.toBe(true);

      const client = redis.getClient();
      await expect(client.get(key)).resolves.toBe('owner-a');
      const ttl = await client.pTTL(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(30000);
    });

    it('已被別人持有時回 false，不覆蓋原本的值', async () => {
      const key = newKey();
      await lock.acquire(key, 'owner-a', 30000);

      await expect(lock.acquire(key, 'owner-b', 30000)).resolves.toBe(false);
      await expect(redis.getClient().get(key)).resolves.toBe('owner-a');
    });

    it('同一個 owner 重複取得也回 false（呼叫端要先釋放舊鎖）', async () => {
      const key = newKey();
      await lock.acquire(key, 'owner-a', 30000);

      await expect(lock.acquire(key, 'owner-a', 30000)).resolves.toBe(false);
    });

    it('TTL 到期後別人可以取得', async () => {
      const key = newKey();
      await lock.acquire(key, 'owner-a', 50);

      await sleep(120);

      await expect(lock.acquire(key, 'owner-b', 30000)).resolves.toBe(true);
      await expect(redis.getClient().get(key)).resolves.toBe('owner-b');
    });
  });

  describe('release', () => {
    it('owner 相同時刪除並回 true', async () => {
      const key = newKey();
      await lock.acquire(key, 'owner-a', 30000);

      await expect(lock.release(key, 'owner-a')).resolves.toBe(true);
      await expect(redis.getClient().exists(key)).resolves.toBe(0);
    });

    it('owner 不同時回 false，別人的鎖保留', async () => {
      const key = newKey();
      await lock.acquire(key, 'owner-a', 30000);

      await expect(lock.release(key, 'owner-b')).resolves.toBe(false);
      await expect(redis.getClient().get(key)).resolves.toBe('owner-a');
    });

    it('key 不存在時回 false', async () => {
      const key = newKey();

      await expect(lock.release(key, 'owner-a')).resolves.toBe(false);
    });

    it('A 的鎖過期被 B 取得後，A 釋放不會刪到 B 的鎖', async () => {
      const key = newKey();
      await lock.acquire(key, 'owner-a', 50);
      await sleep(120);
      await lock.acquire(key, 'owner-b', 30000);

      await expect(lock.release(key, 'owner-a')).resolves.toBe(false);
      await expect(redis.getClient().get(key)).resolves.toBe('owner-b');
    });

    it('釋放後可以重新取得', async () => {
      const key = newKey();
      await lock.acquire(key, 'owner-a', 30000);
      await lock.release(key, 'owner-a');

      await expect(lock.acquire(key, 'owner-b', 30000)).resolves.toBe(true);
    });
  });

  describe('withLock', () => {
    afterEach(() => jest.restoreAllMocks());

    it('5 個同時呼叫只有 1 個執行 fn，其餘立刻回 acquired: false', async () => {
      // Arrange
      const key = newKey();
      let running = 0;
      let maxRunning = 0;
      const fn = async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await sleep(100);
        running--;
        return 'done';
      };

      // Act
      const outcomes = await Promise.all(
        Array.from({ length: 5 }, () => lock.withLock(key, 30000, fn)),
      );

      // Assert
      expect(outcomes.filter((outcome) => outcome.acquired)).toEqual([
        { acquired: true, result: 'done' },
      ]);
      expect(outcomes.filter((outcome) => !outcome.acquired)).toHaveLength(4);
      expect(maxRunning).toBe(1);
    });

    it('fn 執行期間鎖存在且帶 TTL，完成後被刪除', async () => {
      // Arrange
      const key = newKey();
      const client = redis.getClient();
      let ttlDuringFn = 0;

      // Act
      await lock.withLock(key, 30000, async () => {
        ttlDuringFn = await client.pTTL(key);
      });

      // Assert
      expect(ttlDuringFn).toBeGreaterThan(0);
      expect(ttlDuringFn).toBeLessThanOrEqual(30000);
      await expect(client.exists(key)).resolves.toBe(0);
    });

    it('fn 丟錯時鎖仍被刪除，錯誤原樣丟出，之後可以再取得', async () => {
      // Arrange
      const key = newKey();
      const fnError = new Error('updateMany failed');

      // Act
      const result = lock.withLock(key, 30000, () => Promise.reject(fnError));

      // Assert
      await expect(result).rejects.toBe(fnError);
      await expect(redis.getClient().exists(key)).resolves.toBe(0);
      await expect(
        lock.withLock(key, 30000, () => Promise.resolve(1)),
      ).resolves.toEqual({ acquired: true, result: 1 });
    });

    it('fn 超過 TTL、鎖被別人取得時，不刪別人的鎖並記 warn redis.lock.lost', async () => {
      // Arrange
      const key = newKey();
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      // Act
      const outcome = await lock.withLock(key, 50, async () => {
        await sleep(120);
        // The lock expired while fn was still running; another instance takes it.
        await lock.acquire(key, 'owner-b', 30000);
        return 'late';
      });

      // Assert
      expect(outcome).toEqual({ acquired: true, result: 'late' });
      await expect(redis.getClient().get(key)).resolves.toBe('owner-b');
      expect(warn).toHaveBeenCalledWith(
        { event: LOG_EVENTS.redisLockLost, key },
        '鎖在執行途中失效',
      );
    });
  });
});
