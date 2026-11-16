import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class RedisLockService {
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
}
