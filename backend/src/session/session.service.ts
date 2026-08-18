import { Injectable } from '@nestjs/common';
import { SessionRepository } from './session.repository';
import { createHash, randomBytes } from 'node:crypto';
import type { Session } from './session.type';
@Injectable()
export class SessionService {
  constructor(private readonly sessionRepository: SessionRepository) {}
  private readonly sessionTtlSeconds = 60 * 60 * 24 * 7;
  /** hash session id */
  private hashSessionId = (sessionId: string): string => {
    return createHash('sha256').update(sessionId).digest('hex');
  };
  /** 儲存 */
  async save(userId: string): Promise<string> {
    const sessionId = randomBytes(32).toString('base64url');
    const sessionIdHash = this.hashSessionId(sessionId);
    const session: Session = {
      userId,
      createdAt: new Date().toISOString(),
    };
    await this.sessionRepository.save(
      sessionIdHash,
      session,
      this.sessionTtlSeconds,
    );
    return sessionId;
  }
  /** 取得 */
  async get(sessionId: string): Promise<Session | null> {
    const sessionIdHash = this.hashSessionId(sessionId);
    const result = await this.sessionRepository.get(sessionIdHash);
    try {
      if (result) {
        return JSON.parse(result) as Session;
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  /** 刪除 */
  async delete(sessionId: string): Promise<boolean> {
    const sessionIdHash = this.hashSessionId(sessionId);
    const result = await this.sessionRepository.delete(sessionIdHash);
    return result;
  }
}
