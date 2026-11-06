import { Injectable } from '@nestjs/common';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { redisKeys } from '@/infrastructure/redis/redis.keys';
import type {
  CurrentSession,
  StoredSession,
} from '@/modules/session/session.type';
import { storedSessionSchema } from './session.schema';
import type { RotateSessionReply } from './session.script';

type RotateSessionParams = {
  oldSessionIdHash: string;
  newSessionIdHash: string;
  userId: string;
  nowMs: number;
  newRotateAtMs: number;
  newExpiresAtMs: number;
  graceUntilMs: number;
};

@Injectable()
export class SessionRepository {
  constructor(private readonly redisService: RedisService) {}
  /** 輪轉 Session */
  async rotateSession({
    oldSessionIdHash,
    newSessionIdHash,
    userId,
    nowMs,
    newRotateAtMs,
    newExpiresAtMs,
    graceUntilMs,
  }: RotateSessionParams): Promise<RotateSessionReply> {
    const oldSessionKey = redisKeys.session(oldSessionIdHash);
    const newSessionKey = redisKeys.session(newSessionIdHash);
    const userSessionsKey = redisKeys.userSessions(userId);
    const client = this.redisService.getClient();
    return client.rotateSession({
      oldSessionKey,
      newSessionKey,
      userSessionsKey,
      oldSessionIdHash,
      newSessionIdHash,
      nowMs,
      newRotateAtMs,
      newExpiresAtMs,
      graceUntilMs,
    });
  }
  /** 建立Current Session */
  async createCurrentSession(
    sessionIdHash: string,
    session: CurrentSession,
    maxDevices: number,
  ) {
    const currentSessionKey = redisKeys.session(sessionIdHash);
    const zSetKey = redisKeys.userSessions(session.userId);
    const client = this.redisService.getClient();
    await client.createCurrentSession({
      currentSessionKey,
      userSessionsKey: zSetKey,
      sessionIdHash,
      nowMs: session.tokenIssuedAtMs,
      expiresAtMs: session.expiresAtMs,
      maxDevices,
      sessionKeyPrefix: redisKeys.session(''),
      userId: session.userId,
      familyId: session.familyId,
      generation: session.generation,
      familyCreatedAtMs: session.familyCreatedAtMs,
      tokenIssuedAtMs: session.tokenIssuedAtMs,
      rotateAtMs: session.rotateAtMs,
    });
  }

  /** 取得Session */
  async getSession(sessionIdHash: string): Promise<StoredSession | null> {
    const client = this.redisService.getClient();
    const key = redisKeys.session(sessionIdHash);
    const rawSession = await client.hGetAll(key);

    if (Object.keys(rawSession).length === 0) {
      return null;
    }

    const result = storedSessionSchema.safeParse(rawSession);

    if (!result.success) {
      return null;
    }

    return result.data;
  }

  /** 撤銷session */
  async revokeSession(userId: string, sessionIdHash: string) {
    const sessionKey = redisKeys.session(sessionIdHash);
    const userSessionsKey = redisKeys.userSessions(userId);
    const client = this.redisService.getClient();
    const result = await client.revokeSession({
      sessionKey,
      userSessionsKey,
      sessionIdHash,
    });
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
