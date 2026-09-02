import { Injectable } from '@nestjs/common';
import { SessionRepository } from './session.repository';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type {
  AuthenticateSessionResult,
  CurrentSession,
  StoredSession,
} from './session.type';
import { DateTime } from 'luxon';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env';
@Injectable()
export class SessionService {
  constructor(
    private readonly configService: ConfigService<Env>,
    private readonly sessionRepository: SessionRepository,
  ) {}
  /** hash session id */
  private hashSessionId = (sessionId: string): string => {
    return createHash('sha256').update(sessionId).digest('hex');
  };

  /** 儲存最新的session */
  async saveCurrentSession(userId: string): Promise<string> {
    const sessionExpireDay = this.configService.getOrThrow(
      'SESSION_EXPIRE_DAY',
      { infer: true },
    );

    const sessionRotateMinute = this.configService.getOrThrow(
      'SESSION_ROTATE_MINUTE',
      { infer: true },
    );
    const now = DateTime.utc();
    const nowMs = now.toMillis();
    const expiresAtMs = now.plus({ days: sessionExpireDay }).toMillis();
    const rotateAtMs = now.plus({ minutes: sessionRotateMinute }).toMillis();
    const maxDevice = this.configService.getOrThrow('MAX_DEVICE', {
      infer: true,
    });
    const sessionId = randomBytes(32).toString('base64url');
    const sessionIdHash = this.hashSessionId(sessionId);
    const familyId = randomUUID();

    const session: CurrentSession = {
      userId,
      familyId,
      state: 'current',
      generation: 1,
      familyCreatedAtMs: nowMs,
      tokenIssuedAtMs: nowMs,
      expiresAtMs,
      rotateAtMs,
    };
    await this.sessionRepository.createCurrentSession(
      sessionIdHash,
      session,
      maxDevice,
    );
    return sessionId;
  }

  /** 認證session */
  async authenticateSession(
    sessionId: string,
  ): Promise<AuthenticateSessionResult | null> {
    const oldSessionIdHash = this.hashSessionId(sessionId);
    const session = await this.sessionRepository.getSession(oldSessionIdHash);
    if (!session) {
      return null;
    }
    if (session.state === 'grace') {
      return {
        userId: session.userId,
      };
    }
    const now = DateTime.utc();
    const nowMs = now.toMillis();
    if (session.rotateAtMs > nowMs) {
      return {
        userId: session.userId,
      };
    }

    const sessionExpireDay = this.configService.getOrThrow(
      'SESSION_EXPIRE_DAY',
      { infer: true },
    );

    const sessionRotateMinute = this.configService.getOrThrow(
      'SESSION_ROTATE_MINUTE',
      { infer: true },
    );
    const newSessionId = randomBytes(32).toString('base64url');
    const newSessionIdHash = this.hashSessionId(newSessionId);
    const newRotateAtMs = now.plus({ minutes: sessionRotateMinute }).toMillis();
    const newExpiresAtMs = now.plus({ days: sessionExpireDay }).toMillis();
    const graceUntilMs = now.plus({ seconds: 20 }).toMillis();
    const rotateResult = await this.sessionRepository.rotateSession({
      oldSessionIdHash,
      newSessionIdHash,
      userId: session.userId,
      nowMs,
      newRotateAtMs,
      newExpiresAtMs,
      graceUntilMs,
    });

    switch (rotateResult.status) {
      case 'MISSING':
        return null;

      case 'CURRENT':
      case 'GRACE':
        return {
          userId: rotateResult.userId,
        };

      case 'ROTATED':
        return {
          userId: rotateResult.userId,
          rotatedSessionId: newSessionId,
        };
    }
  }
  /** 撤銷Session */
  async revokeSession(sessionId: string): Promise<void> {
    const sessionIdHash = this.hashSessionId(sessionId);
    const session = await this.sessionRepository.getSession(sessionIdHash);
    if (session === null) {
      return;
    }
    const userId = session.userId;
    await this.sessionRepository.revokeSession(userId, sessionIdHash);
  }
  /** 取得 */
  async getSession(sessionId: string): Promise<StoredSession | null> {
    const sessionIdHash = this.hashSessionId(sessionId);
    return this.sessionRepository.getSession(sessionIdHash);
  }
  /** 刪除 */
  async delete(sessionId: string): Promise<boolean> {
    const sessionIdHash = this.hashSessionId(sessionId);
    const result = await this.sessionRepository.delete(sessionIdHash);
    return result;
  }
}
