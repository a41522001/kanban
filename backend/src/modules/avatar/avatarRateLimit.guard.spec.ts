import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { ApiCode } from '@kanban/contracts/api';
import { AppException } from '@/common/exceptions/app.exception';
import { redisKeys } from '@/infrastructure/redis/redis.keys';
import type { RedisService } from '@/infrastructure/redis/redis.service';
import {
  AVATAR_UPLOAD_LIMIT,
  AVATAR_UPLOAD_WINDOW_SECONDS,
} from './avatar.constants';
import { AvatarRateLimitGuard } from './avatarRateLimit.guard';

const userId = '6b3a1c4e-2f0d-4a8b-9c7e-1d2f3a4b5c6d';
const key = redisKeys.rateLimitAvatarUpload(userId);

const createContext = (): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ userId }),
    }),
  }) as unknown as ExecutionContext;

describe('AvatarRateLimitGuard', () => {
  let guard: AvatarRateLimitGuard;
  let incr: jest.Mock<Promise<number>, [string]>;
  let expire: jest.Mock<Promise<number>, [string, number, string]>;
  let ttl: jest.Mock<Promise<number>, [string]>;

  /** 取得 canActivate 丟出的錯誤，方便檢查狀態碼、code 與 data。 */
  const catchGuardError = async (): Promise<AppException> => {
    try {
      await guard.canActivate(createContext());
    } catch (error) {
      return error as AppException;
    }
    throw new Error('Expected guard to throw');
  };

  beforeEach(() => {
    incr = jest.fn<Promise<number>, [string]>().mockResolvedValue(1);
    expire = jest
      .fn<Promise<number>, [string, number, string]>()
      .mockResolvedValue(1);
    ttl = jest.fn<Promise<number>, [string]>().mockResolvedValue(42);
    const redisService = {
      getClient: () => ({ incr, expire, ttl }),
    } as unknown as RedisService;
    guard = new AvatarRateLimitGuard(redisService);
  });

  it('時間窗內第一次上傳時通過，並以 NX 設定過期時間', async () => {
    await expect(guard.canActivate(createContext())).resolves.toBe(true);

    expect(incr).toHaveBeenCalledWith(key);
    expect(expire).toHaveBeenCalledWith(
      key,
      AVATAR_UPLOAD_WINDOW_SECONDS,
      'NX',
    );
  });

  it(`第 ${AVATAR_UPLOAD_LIMIT} 次仍通過`, async () => {
    incr.mockResolvedValue(AVATAR_UPLOAD_LIMIT);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(ttl).not.toHaveBeenCalled();
  });

  it(`第 ${AVATAR_UPLOAD_LIMIT + 1} 次丟 429 / AvatarRateLimited 並帶 retryAfterSeconds`, async () => {
    incr.mockResolvedValue(AVATAR_UPLOAD_LIMIT + 1);

    const error = await catchGuardError();

    expect(error).toBeInstanceOf(AppException);
    expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(error.code).toBe(ApiCode.AvatarRateLimited);
    expect(error.data).toEqual({ retryAfterSeconds: 42 });
  });

  it('超過限制時仍會呼叫 EXPIRE NX，補上可能遺失的過期時間', async () => {
    incr.mockResolvedValue(AVATAR_UPLOAD_LIMIT + 1);

    await catchGuardError();

    expect(expire).toHaveBeenCalledWith(
      key,
      AVATAR_UPLOAD_WINDOW_SECONDS,
      'NX',
    );
  });

  it('TTL 為負數（key 剛好過期）時 retryAfterSeconds 為 0', async () => {
    incr.mockResolvedValue(AVATAR_UPLOAD_LIMIT + 1);
    ttl.mockResolvedValue(-2);

    const error = await catchGuardError();

    expect(error.data).toEqual({ retryAfterSeconds: 0 });
  });
});
