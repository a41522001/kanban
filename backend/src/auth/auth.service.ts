import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type {
  EmailVerificationRequiredData,
  LoginRequest,
  ResendVerificationEmailResult,
  SignupRequest,
  SignupResult,
} from '@kanban/contracts/auth';
import { ApiCode } from '@kanban/contracts/api';
import { AppException } from '@/common/exceptions/app.exception';
import { decodePassword, saltPassword } from '@/common/utils';
import { ConfigService } from '@nestjs/config';
import { Env } from '@/config/env';
import { SessionService } from '@/session/session.service';
import { UserService } from '@/user/user.service';
import { SocketService } from '@/socket/socket.service';
import { QueueService } from '@/queue/queue.service';
import { randomBytes } from 'crypto';
import { RedisService } from '@/redis/redis.service';
import { redisKeys } from '@/redis/redis.keys';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly rateLimitEmailVerifySeconds: number;
  constructor(
    private readonly configService: ConfigService<Env>,
    private readonly sessionService: SessionService,
    private readonly userService: UserService,
    private readonly socketService: SocketService,
    private readonly queueService: QueueService,
    private readonly redisService: RedisService,
  ) {
    this.rateLimitEmailVerifySeconds = this.configService.getOrThrow(
      'RATE_LIMIT_VERIFY_EMAIL_SECONDS',
      { infer: true },
    );
  }

  /** 註冊 */
  async signup(data: SignupRequest): Promise<SignupResult | false> {
    const { email, password, name } = data;
    const user = await this.userService.getByEmail(email);
    if (user) {
      return false;
    }
    const passwordHash = await saltPassword(password, this.configService);
    const newUser = await this.userService.createUser({
      email,
      passwordHash,
      displayName: name,
    });
    const payload = {
      userId: newUser.id,
      email: email,
      token: randomBytes(32).toString('base64url'),
    };
    const key = redisKeys.rateLimitEmailVerify(email);
    const redisClient = this.redisService.getClient();
    try {
      // 首次寄信先設定 Redis 冷卻，避免註冊後立刻重寄。
      await redisClient.set(key, '1', {
        EX: this.rateLimitEmailVerifySeconds,
      });
      // BullMQ 入列完成只代表工作已被接受，寄信由 Worker 執行。
      await this.queueService.addVerificationEmailQueue(payload);
      return {
        accountCreated: true,
        emailQueued: true,
        retryAfterSeconds: this.rateLimitEmailVerifySeconds,
      };
    } catch (error) {
      this.logger.error('帳號已建立，但驗證信無法入列', error);
      // 帳號已寫入 DB，前端應提供重寄，而不是要求重新註冊。
      return {
        accountCreated: true,
        emailQueued: false,
        retryAfterSeconds: await this.getRemainingCooldown(email),
      };
    }
  }
  /** 登入 */
  async login(data: LoginRequest): Promise<string | null> {
    const { email, password } = data;
    const user = await this.userService.getByEmail(email);
    if (!user) {
      return null;
    }
    if (user.authProvider !== 'LOCAL' || user.passwordHash === null) {
      return null;
    }
    const isCorrect = await decodePassword(password, user.passwordHash);
    if (isCorrect) {
      if (user.emailVerifiedAt === null) {
        const data: EmailVerificationRequiredData = { email: user.email };
        throw new AppException({
          code: ApiCode.EmailVerificationRequired,
          message: '請先驗證信箱',
          status: HttpStatus.FORBIDDEN,
          data,
        });
      }
      const sessionId = await this.sessionService.saveCurrentSession(user.id);
      return sessionId;
    }

    return null;
  }
  /** 登出 */
  async logout(sessionId: string): Promise<void> {
    await this.sessionService.revokeSession(sessionId);
    this.socketService.disconnectSession(sessionId);
  }
  /** 驗證信箱 */
  async verifyEmail(token: string) {
    const redisClient = this.redisService.getClient();
    const redisKey = redisKeys.verifyEmail(token);
    const data = await redisClient.hGetAll(redisKey);
    if (!data.userId || !data.email) {
      return false;
    }
    // Redis / DB 故障向外拋出，交給既有 filter 回傳 500。
    const user = await this.userService.getByEmail(data.email);
    if (
      user === null ||
      user.id !== data.userId ||
      user.authProvider !== 'LOCAL'
    ) {
      return false;
    }
    if (user.emailVerifiedAt === null) {
      await this.userService.updateUserToVerifiedAccount(data.userId);
    }
    // DB 更新成功後才刪 Redis token；其他仍有效的舊信不會重寫驗證時間。
    await redisClient.del(redisKey);
    return true;
  }
  /** 重寄驗證信 */
  async resendVerificationEmail(
    email: string,
  ): Promise<ResendVerificationEmailResult> {
    const key = redisKeys.rateLimitEmailVerify(email);
    const redisClient = this.redisService.getClient();
    // NX + EX 在 Redis 內一次完成檢查與設定，避免同時請求重複入列。
    // 所有 Email 都套用冷卻，公開 API 使用一致的受理與倒數行為。
    const acquired = await redisClient.set(key, '1', {
      NX: true,
      EX: this.rateLimitEmailVerifySeconds,
    });

    if (acquired === null) {
      throw new AppException({
        code: ApiCode.EmailVerificationCooldown,
        message: '冷卻中，請稍後再試',
        status: HttpStatus.TOO_MANY_REQUESTS,
        data: { retryAfterSeconds: Math.max(0, await redisClient.ttl(key)) },
      });
    }

    const user = await this.userService.getByEmail(email);
    if (user?.authProvider === 'LOCAL' && user.emailVerifiedAt === null) {
      try {
        // 只有尚未驗證的 LOCAL 帳號才建立 BullMQ 寄信工作。
        await this.queueService.addVerificationEmailQueue({
          userId: user.id,
          email,
          token: randomBytes(32).toString('base64url'),
        });
      } catch (error) {
        this.logger.error('重寄驗證信無法入列', error);
        throw new AppException({
          code: ApiCode.VerificationEmailQueueFailed,
          message: '暫時無法安排寄送驗證信，請稍後重試',
          status: HttpStatus.SERVICE_UNAVAILABLE,
          data: { retryAfterSeconds: await this.getRemainingCooldown(email) },
        });
      }
    }
    return { retryAfterSeconds: this.rateLimitEmailVerifySeconds };
  }

  private async getRemainingCooldown(email: string): Promise<number> {
    try {
      const ttl = await this.redisService
        .getClient()
        .ttl(redisKeys.rateLimitEmailVerify(email));
      return Math.max(0, ttl);
    } catch {
      // 入列失敗時 Redis 也可能故障，仍要讓前端知道帳號已建立。
      return this.rateLimitEmailVerifySeconds;
    }
  }
}
