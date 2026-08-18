import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { redisKeys } from '../redis/redis.keys';
import type { Session } from '@/session/session.type';
@Injectable()
export class SessionRepository {
  constructor(private readonly redisService: RedisService) {}
  /** 儲存 */
  async save(
    sessionIdHash: string,
    session: Session,
    ttlSeconds: number,
  ): Promise<void> {
    const client = this.redisService.getClient();
    const key = redisKeys.session(sessionIdHash);
    await client.set(key, JSON.stringify(session), {
      EX: ttlSeconds,
    });
  }
  /** 取得 */
  async get(sessionIdHash: string): Promise<string | null> {
    const client = this.redisService.getClient();
    const key = redisKeys.session(sessionIdHash);
    const result = await client.get(key);
    return result;
  }
  /** 刪除 */
  async delete(sessionIdHash: string): Promise<boolean> {
    const client = this.redisService.getClient();
    const key = redisKeys.session(sessionIdHash);
    const deletedCount = await client.del(key);
    return deletedCount > 0;
  }
}
