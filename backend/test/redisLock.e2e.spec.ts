import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { envSchema } from '../src/config/env';
import { configNamespaces } from '../src/config';
import { RedisModule } from '../src/infrastructure/redis/redis.module';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { RedisLockService } from '../src/infrastructure/redis/redisLock.service';

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
});
