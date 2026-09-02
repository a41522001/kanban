import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { redisKeys } from '../redis/redis.keys';
import type { CurrentSession, StoredSession } from '@/session/session.type';
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
    // /*
    //  * 第一階段：
    //  * 1. 清除過期的 ZSET members
    //  * 2. 建立 Current Session Hash
    //  * 3. 設定 Current Session TTL
    //  * 4. 加入使用者 Session ZSET
    //  * 5. 設定 ZSET TTL
    //  */
    // const createMulti = client.multi();
    // createMulti.zRemRangeByScore(zSetKey, '-inf', session.tokenIssuedAtMs);
    // createMulti.hSet(currentSessionKey, session);
    // createMulti.pExpireAt(currentSessionKey, session.expiresAtMs);
    // createMulti.zAdd(zSetKey, {
    //   value: sessionIdHash,
    //   score: session.expiresAtMs,
    // });
    // createMulti.pExpireAt(zSetKey, session.expiresAtMs);
    // await createMulti.exec();

    // /*
    //  * 第二階段：
    //  * 檢查目前裝置數量。
    //  */
    // const memberCount = await client.zCard(zSetKey);
    // const overflowCount = memberCount - maxDevices;
    // if (overflowCount <= 0) {
    //   return;
    // }
    // /*
    //  * 第三階段：
    //  * 找出需要被淘汰的 Session。
    //  *
    //  * ZSET 由 score 小到大排列，
    //  * score 是 expiresAtMs，
    //  * 所以前面的 member 是最早到期的 Session。
    //  */
    // const evictedSessionIdHashes = await client.zRange(
    //   zSetKey,
    //   0,
    //   overflowCount - 1,
    // );
    // /*
    //  * 第四階段：
    //  * 先取得每個被淘汰 Current Session 對應的
    //  * Previous Grace Session Hash。
    //  */
    // const sessionsToDelete: Array<{
    //   currentSessionIdHash: string;
    //   previousSessionIdHash: string | null;
    // }> = [];

    // for (const currentSessionIdHash of evictedSessionIdHashes) {
    //   const currentSessionKey = redisKeys.session(currentSessionIdHash);

    //   const previousSessionIdHash = await client.hGet(
    //     currentSessionKey,
    //     'previousSessionIdHash',
    //   );

    //   sessionsToDelete.push({
    //     currentSessionIdHash,
    //     previousSessionIdHash,
    //   });
    // }

    // /*
    //  * 第五階段：
    //  * 使用同一個 MULTI 刪除：
    //  * 1. Current Session Hash
    //  * 2. Previous Grace Session Hash
    //  * 3. ZSET member
    //  */
    // const deleteMulti = client.multi();

    // for (const {
    //   currentSessionIdHash,
    //   previousSessionIdHash,
    // } of sessionsToDelete) {
    //   deleteMulti.del(redisKeys.session(currentSessionIdHash));

    //   deleteMulti.zRem(zSetKey, currentSessionIdHash);

    //   if (previousSessionIdHash) {
    //     deleteMulti.del(redisKeys.session(previousSessionIdHash));
    //   }
    // }

    // await deleteMulti.exec();
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
  // /** 儲存 */
  // async save(
  //   sessionIdHash: string,
  //   session: Session,
  //   ttlSeconds: number,
  // ): Promise<void> {
  //   const client = this.redisService.getClient();
  //   const key = redisKeys.session(sessionIdHash);
  //   await client.set(key, JSON.stringify(session), {
  //     EX: ttlSeconds,
  //   });
  // }
  // /** 取得 */
  // async get(sessionIdHash: string): Promise<string | null> {
  //   const client = this.redisService.getClient();
  //   const key = redisKeys.session(sessionIdHash);
  //   const result = await client.get(key);
  //   return result;
  // }
  // /** 刪除 */
  // async delete(sessionIdHash: string): Promise<boolean> {
  //   const client = this.redisService.getClient();
  //   const key = redisKeys.session(sessionIdHash);
  //   const deletedCount = await client.del(key);
  //   return deletedCount > 0;
  // }
}
