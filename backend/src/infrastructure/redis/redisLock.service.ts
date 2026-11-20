import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { randomUUID } from 'node:crypto';
import { LOG_EVENTS } from '@/common/constants/logEvents';
export type WithLockOutcome<T> =
  { acquired: true; result: T } | { acquired: false };

@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);
  constructor(private readonly redisService: RedisService) {}
  async acquire(key: string, owner: string, ttlMs: number): Promise<boolean> {
    const client = this.redisService.getClient();
    const result = await client.set(key, owner, {
      expiration: {
        type: 'PX',
        value: ttlMs,
      },
      condition: 'NX',
    });

    return result === 'OK';
  }

  async release(key: string, owner: string): Promise<boolean> {
    const client = this.redisService.getClient();
    return await client.releaseLock({ key, owner });
  }

  async withLock<T>(
    key: string,
    ttlMs: number,
    fn: () => Promise<T>,
  ): Promise<WithLockOutcome<T>> {
    const token = randomUUID();
    const acquired = await this.acquire(key, token, ttlMs);
    if (!acquired) {
      return { acquired: false };
    }
    try {
      const result = await fn();
      return { acquired: true, result };
    } finally {
      try {
        const release = await this.release(key, token);
        if (!release) {
          // fn 執行得比 TTL 久：鎖已過期，期間可能已被別台取得，代表 TTL 需要調長。
          this.logger.warn(
            { event: LOG_EVENTS.redisLockLost, key },
            '鎖在執行途中失效',
          );
        }
      } catch (error) {
        // 不往外丟：在 finally 丟錯會蓋掉 fn 原本的錯誤；鎖會在 TTL 到期後自動消失。
        this.logger.warn(
          { event: LOG_EVENTS.redisLockReleaseFailed, key, err: error },
          '釋放鎖失敗，等待 TTL 過期',
        );
      }
    }
  }
}
