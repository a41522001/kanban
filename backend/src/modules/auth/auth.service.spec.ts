import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SessionService } from '@/modules/session/session.service';
import bcrypt from 'bcrypt';
import { UserService } from '@/modules/user/user.service';
import { SocketService } from '@/modules/socket/socket.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { QueueService } from '@/infrastructure/queue/queue.service';
import { ApiCode } from '@kanban/contracts/api';
import type { User } from '@/generated/prisma/client';
import { AppException } from '@/common/exceptions/app.exception';
import { LOG_EVENTS } from '@/common/constants/logEvents';
import { RateLimitService } from '@/infrastructure/redis/rateLimit.service';
describe('AuthService', () => {
  let authService: AuthService;
  let userService: UserService;
  let sessionService: SessionService;
  let socketService: SocketService;
  let queueService: QueueService;
  let rateLimitService: RateLimitService;
  // A documentation-range address (RFC 5737), as req.ip would be after trust proxy.
  const ip = '203.0.113.5';
  const pendingUser: User = {
    id: '1',
    email: 'test@test.com',
    displayName: 'test',
    passwordHash: 'hash',
    authProvider: 'LOCAL',
    emailVerifiedAt: null,
    googleSub: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let redisClient: {
    set: jest.Mock;
    ttl: jest.Mock;
    hGetAll: jest.Mock;
    del: jest.Mock;
  };
  beforeEach(async () => {
    redisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      ttl: jest.fn().mockResolvedValue(60),
      hGetAll: jest.fn(),
      del: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'auth.rateLimitVerifyEmailSeconds' ? 60 : 3,
            ),
          },
        },
        {
          provide: SessionService,
          useValue: {
            saveCurrentSession: jest.fn(),
            delete: jest.fn(),
            revokeSession: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            createUser: jest.fn(),
            getByEmail: jest.fn(),
            getById: jest.fn(),
            updateUserToVerifiedAccount: jest.fn(),
          },
        },
        {
          provide: SocketService,
          useValue: {
            disconnectFamily: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(redisClient),
          },
        },
        {
          provide: QueueService,
          useValue: {
            addVerificationEmailQueue: jest.fn(),
          },
        },
        {
          provide: RateLimitService,
          useValue: {
            // Allowed by default; rate-limit tests override per case.
            hitLogin: jest
              .fn()
              .mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
            hitSignup: jest
              .fn()
              .mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
            refundLogin: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    sessionService = module.get<SessionService>(SessionService);
    socketService = module.get<SocketService>(SocketService);
    queueService = module.get<QueueService>(QueueService);
    rateLimitService = module.get<RateLimitService>(RateLimitService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  /** 註冊 */
  describe('signup', () => {
    const req = {
      email: 'test@test.com',
      password: 'testtest',
      name: 'test',
    };

    it('註冊成功', async () => {
      const getByEmailSpy = jest
        .spyOn(userService, 'getByEmail')
        .mockResolvedValue(null);
      const createSpy = jest
        .spyOn(userService, 'createUser')
        .mockResolvedValue({
          id: '1',
          email: req.email,
          displayName: req.name,
          passwordHash: 'hashed-password',
          authProvider: 'LOCAL',
          emailVerifiedAt: null,
          googleSub: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      const addJobSpy = jest.spyOn(queueService, 'addVerificationEmailQueue');

      const result = await authService.signup(req, ip);
      expect(result).toEqual({
        accountCreated: true,
        emailQueued: true,
        retryAfterSeconds: 60,
      });
      expect(getByEmailSpy).toHaveBeenCalledWith(req.email);
      expect(getByEmailSpy).toHaveBeenCalledTimes(1);

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith({
        email: req.email,
        displayName: req.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        passwordHash: expect.any(String),
      });
      expect(addJobSpy).toHaveBeenCalledWith({
        userId: '1',
        email: req.email,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        token: expect.any(String),
      });
      expect(redisClient.set).toHaveBeenCalledWith(
        `rateLimit:emailVerify:${req.email}`,
        '1',
        { EX: 60 },
      );
    });

    it('註冊失敗, 使用者已存在', async () => {
      const getByEmailSpy = jest
        .spyOn(userService, 'getByEmail')
        .mockResolvedValue({
          id: '1',
          displayName: req.name,
          email: req.email,
          passwordHash: 'hashed-password',
          authProvider: 'LOCAL',
          emailVerifiedAt: null,
          googleSub: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      const createSpy = jest.spyOn(userService, 'createUser');
      const result = await authService.signup(req, ip);
      expect(result).toBe(false);
      expect(getByEmailSpy).toHaveBeenCalledWith(req.email);
      expect(getByEmailSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).not.toHaveBeenCalled();
      // A duplicate email still counts, so signup cannot be used to probe registered emails for free.
      expect(jest.spyOn(rateLimitService, 'hitSignup')).toHaveBeenCalledWith(
        ip,
      );
    });

    describe('rate limit', () => {
      it('被擋時回 429 / SignupRateLimited 與倒數秒數，不查 DB、不建立帳號', async () => {
        // Arrange
        jest
          .spyOn(rateLimitService, 'hitSignup')
          .mockResolvedValue({ allowed: false, retryAfterSeconds: 1800 });
        jest
          .spyOn(Logger.prototype, 'warn')
          .mockImplementation(() => undefined);
        const getByEmailSpy = jest.spyOn(userService, 'getByEmail');
        const createSpy = jest.spyOn(userService, 'createUser');

        // Act
        const result = authService.signup(req, ip);

        // Assert
        await expect(result).rejects.toMatchObject({
          code: ApiCode.SignupRateLimited,
          data: { retryAfterSeconds: 1800 },
        });
        await expect(result).rejects.toHaveProperty('status', 429);
        expect(getByEmailSpy).not.toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();
        expect(
          jest.spyOn(queueService, 'addVerificationEmailQueue'),
        ).not.toHaveBeenCalled();
      });

      it('被擋時記 warn，帶 ip 與秒數，不記 email', async () => {
        // Arrange
        jest
          .spyOn(rateLimitService, 'hitSignup')
          .mockResolvedValue({ allowed: false, retryAfterSeconds: 1800 });
        const loggerWarn = jest
          .spyOn(Logger.prototype, 'warn')
          .mockImplementation(() => undefined);

        // Act
        await authService.signup(req, ip).catch(() => undefined);

        // Assert
        expect(loggerWarn).toHaveBeenCalledWith(
          {
            event: LOG_EVENTS.authSignupRateLimited,
            ip,
            retryAfterSeconds: 1800,
          },
          '註冊嘗試次數過多',
        );
        expect(JSON.stringify(loggerWarn.mock.calls)).not.toContain(req.email);
      });

      it('Redis 故障時直接丟出（fail-closed），不建立帳號', async () => {
        // Arrange
        const redisError = new Error('Redis unavailable');
        jest.spyOn(rateLimitService, 'hitSignup').mockRejectedValue(redisError);
        const createSpy = jest.spyOn(userService, 'createUser');

        // Act
        const result = authService.signup(req, ip);

        // Assert
        await expect(result).rejects.toBe(redisError);
        expect(createSpy).not.toHaveBeenCalled();
      });
    });
  });
  describe('verifyEmail', () => {
    it('驗證成功後刪除 token', async () => {
      redisClient.hGetAll.mockResolvedValue({
        userId: '1',
        email: 'test@test.com',
      });
      jest.spyOn(userService, 'getByEmail').mockResolvedValue(pendingUser);

      await expect(authService.verifyEmail('token')).resolves.toBe(true);
      expect(
        jest.spyOn(userService, 'updateUserToVerifiedAccount'),
      ).toHaveBeenCalledWith('1');
      expect(redisClient.del).toHaveBeenCalledWith('verify:email:token');
    });

    it('已驗證帳號使用其他有效 token，不改寫驗證時間', async () => {
      redisClient.hGetAll.mockResolvedValue({
        userId: '1',
        email: pendingUser.email,
      });
      jest
        .spyOn(userService, 'getByEmail')
        .mockResolvedValue({ ...pendingUser, emailVerifiedAt: new Date() });
      await expect(authService.verifyEmail('old-token')).resolves.toBe(true);
      expect(
        jest.spyOn(userService, 'updateUserToVerifiedAccount'),
      ).not.toHaveBeenCalled();
      expect(redisClient.del).toHaveBeenCalledWith('verify:email:old-token');
    });

    it('無效 token 不更新使用者', async () => {
      redisClient.hGetAll.mockResolvedValue({});
      await expect(authService.verifyEmail('missing')).resolves.toBe(false);
      expect(
        jest.spyOn(userService, 'updateUserToVerifiedAccount'),
      ).not.toHaveBeenCalled();
    });

    it('DB 故障向外拋出且保留 token', async () => {
      const error = new Error('DB unavailable');
      redisClient.hGetAll.mockResolvedValue({
        userId: '1',
        email: pendingUser.email,
      });
      jest.spyOn(userService, 'getByEmail').mockResolvedValue(pendingUser);
      jest
        .spyOn(userService, 'updateUserToVerifiedAccount')
        .mockRejectedValue(error);
      await expect(authService.verifyEmail('token')).rejects.toBe(error);
      expect(redisClient.del).not.toHaveBeenCalled();
    });

    it('Redis 故障不當成連結無效', async () => {
      const error = new Error('Redis unavailable');
      redisClient.hGetAll.mockRejectedValue(error);
      await expect(authService.verifyEmail('token')).rejects.toBe(error);
    });
  });

  it('帳號已建立後入列失敗，回傳可重寄的結果', async () => {
    // Arrange
    const queueError = new Error('Queue unavailable');
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    jest.spyOn(userService, 'getByEmail').mockResolvedValue(null);
    jest.spyOn(userService, 'createUser').mockResolvedValue(pendingUser);
    jest
      .spyOn(queueService, 'addVerificationEmailQueue')
      .mockRejectedValue(queueError);
    redisClient.ttl.mockResolvedValue(52);

    // Act
    const result = authService.signup(
      {
        email: pendingUser.email,
        password: 'testtest',
        name: 'test',
      },
      ip,
    );

    // Assert
    await expect(result).resolves.toEqual({
      accountCreated: true,
      emailQueued: false,
      retryAfterSeconds: 52,
    });
    // 接住後不再丟出，由 service 記錄：物件在前、錯誤放在 err，不記 email
    expect(loggerError).toHaveBeenCalledWith(
      {
        event: LOG_EVENTS.authSignupEmailEnqueueFailed,
        err: queueError,
        userId: pendingUser.id,
      },
      '帳號已建立，但驗證信無法入列',
    );
  });

  it('帳號已建立後 Redis 故障，仍回傳帳號已建立', async () => {
    jest.spyOn(userService, 'getByEmail').mockResolvedValue(null);
    jest.spyOn(userService, 'createUser').mockResolvedValue(pendingUser);
    redisClient.set.mockRejectedValue(new Error('Redis unavailable'));
    redisClient.ttl.mockRejectedValue(new Error('Redis unavailable'));
    await expect(
      authService.signup(
        {
          email: pendingUser.email,
          password: 'testtest',
          name: 'test',
        },
        ip,
      ),
    ).resolves.toEqual({
      accountCreated: true,
      emailQueued: false,
      retryAfterSeconds: 60,
    });
    expect(
      jest.spyOn(queueService, 'addVerificationEmailQueue'),
    ).not.toHaveBeenCalled();
  });

  describe('resendVerificationEmail', () => {
    const email = 'test@test.com';

    it.each([
      { authProvider: 'GOOGLE', emailVerifiedAt: null },
      { authProvider: 'LOCAL', emailVerifiedAt: new Date() },
    ])('不寄給已驗證或 Google 帳號：%p', async (account) => {
      jest.spyOn(userService, 'getByEmail').mockResolvedValue({
        id: '1',
        email,
        ...account,
      } as Awaited<ReturnType<UserService['getByEmail']>>);

      await expect(authService.resendVerificationEmail(email)).resolves.toEqual(
        { retryAfterSeconds: 60 },
      );
      expect(redisClient.set).toHaveBeenCalled();
      expect(
        jest.spyOn(queueService, 'addVerificationEmailQueue'),
      ).not.toHaveBeenCalled();
    });

    it('冷卻中不重複入列', async () => {
      jest.spyOn(userService, 'getByEmail').mockResolvedValue({
        id: '1',
        email,
        authProvider: 'LOCAL',
        emailVerifiedAt: null,
      } as Awaited<ReturnType<UserService['getByEmail']>>);
      redisClient.set.mockResolvedValue(null);
      redisClient.ttl.mockResolvedValue(42);

      await expect(
        authService.resendVerificationEmail(email),
      ).rejects.toMatchObject({
        code: ApiCode.EmailVerificationCooldown,
        data: { retryAfterSeconds: 42 },
      });
      expect(
        jest.spyOn(queueService, 'addVerificationEmailQueue'),
      ).not.toHaveBeenCalled();
    });

    it('取得寄送資格後入列並回傳成功', async () => {
      jest.spyOn(userService, 'getByEmail').mockResolvedValue({
        id: '1',
        email,
        authProvider: 'LOCAL',
        emailVerifiedAt: null,
      } as Awaited<ReturnType<UserService['getByEmail']>>);

      await expect(authService.resendVerificationEmail(email)).resolves.toEqual(
        { retryAfterSeconds: 60 },
      );
      expect(redisClient.set).toHaveBeenCalledWith(
        `rateLimit:emailVerify:${email}`,
        '1',
        { NX: true, EX: 60 },
      );
      expect(
        jest.spyOn(queueService, 'addVerificationEmailQueue'),
      ).toHaveBeenCalledTimes(1);
    });

    it('不存在的帳號也回傳一致的受理與倒數', async () => {
      jest.spyOn(userService, 'getByEmail').mockResolvedValue(null);
      await expect(authService.resendVerificationEmail(email)).resolves.toEqual(
        { retryAfterSeconds: 60 },
      );
      expect(
        jest.spyOn(queueService, 'addVerificationEmailQueue'),
      ).not.toHaveBeenCalled();
    });

    it('重寄入列失敗回傳專用錯誤和剩餘冷卻', async () => {
      // Arrange
      const queueError = new Error('Queue unavailable');
      const loggerError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      jest.spyOn(userService, 'getByEmail').mockResolvedValue(pendingUser);
      jest
        .spyOn(queueService, 'addVerificationEmailQueue')
        .mockRejectedValue(queueError);

      // Act
      const error: unknown = await authService
        .resendVerificationEmail(email)
        .catch((e: unknown) => e);

      // Assert
      expect(error).toBeInstanceOf(AppException);
      expect(error).toMatchObject({
        code: ApiCode.VerificationEmailQueueFailed,
        data: { retryAfterSeconds: 60 },
        event: LOG_EVENTS.authResendEmailEnqueueFailed,
      });
      // 原始錯誤放進 cause，交給全域 Filter 記錄；service 不重複記
      expect((error as AppException).cause).toBe(queueError);
      expect(loggerError).not.toHaveBeenCalled();
    });
  });
  /** 登入 */
  describe('login', () => {
    const req = {
      email: 'test@test.com',
      password: 'testtest',
    };
    it('查不到User', async () => {
      const getByEmailSpy = jest
        .spyOn(userService, 'getByEmail')
        .mockResolvedValue(null);
      const saveSpy = jest.spyOn(sessionService, 'saveCurrentSession');
      const result = await authService.login(req, ip);
      expect(result).toBeNull();
      expect(getByEmailSpy).toHaveBeenCalledWith(req.email);
      expect(getByEmailSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).not.toHaveBeenCalled();
      // A missing account counts as a failure, exactly like a wrong password.
      expect(
        jest.spyOn(rateLimitService, 'refundLogin'),
      ).not.toHaveBeenCalled();
    });

    it('密碼錯誤', async () => {
      const wrongPasswordHash = await bcrypt.hash('another-password', 4);
      const getByEmailSpy = jest
        .spyOn(userService, 'getByEmail')
        .mockResolvedValue({
          id: '1',
          displayName: 'test',
          email: req.email,
          passwordHash: wrongPasswordHash,
          authProvider: 'LOCAL',
          emailVerifiedAt: null,
          googleSub: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      const saveSpy = jest.spyOn(sessionService, 'saveCurrentSession');
      const result = await authService.login(req, ip);
      expect(result).toBeNull();
      expect(getByEmailSpy).toHaveBeenCalledWith(req.email);
      expect(getByEmailSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).not.toHaveBeenCalled();
      expect(
        jest.spyOn(rateLimitService, 'refundLogin'),
      ).not.toHaveBeenCalled();
    });

    it('登入成功', async () => {
      const passwordHash = await bcrypt.hash(req.password, 4);
      const sessionId = 'session-id';
      const userId = '1';
      const getByEmailSpy = jest
        .spyOn(userService, 'getByEmail')
        .mockResolvedValue({
          id: userId,
          displayName: 'test',
          email: req.email,
          passwordHash,
          authProvider: 'LOCAL',
          emailVerifiedAt: new Date(),
          googleSub: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      const saveSpy = jest
        .spyOn(sessionService, 'saveCurrentSession')
        .mockResolvedValue(sessionId);
      const result = await authService.login(req, ip);
      expect(getByEmailSpy).toHaveBeenCalledWith(req.email);
      expect(getByEmailSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledWith(userId);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(result).toBe(sessionId);
      expect(jest.spyOn(rateLimitService, 'hitLogin')).toHaveBeenCalledWith(
        req.email,
        ip,
      );
      expect(jest.spyOn(rateLimitService, 'refundLogin')).toHaveBeenCalledWith(
        req.email,
        ip,
      );
    });

    it('密碼正確但未驗證，回傳 EmailVerificationRequired 且不建立 Session', async () => {
      const passwordHash = await bcrypt.hash(req.password, 4);
      jest
        .spyOn(userService, 'getByEmail')
        .mockResolvedValue({ ...pendingUser, passwordHash });
      await expect(authService.login(req, ip)).rejects.toMatchObject({
        code: ApiCode.EmailVerificationRequired,
        data: { email: req.email },
      });
      expect(
        jest.spyOn(sessionService, 'saveCurrentSession'),
      ).not.toHaveBeenCalled();
      // The password was right, so the attempt is refunded before the 403 is thrown.
      expect(jest.spyOn(rateLimitService, 'refundLogin')).toHaveBeenCalledWith(
        req.email,
        ip,
      );
    });

    describe('rate limit', () => {
      it('被擋時回 429 / LoginRateLimited 與倒數秒數，不查 DB、不比對密碼、不退回', async () => {
        // Arrange
        jest
          .spyOn(rateLimitService, 'hitLogin')
          .mockResolvedValue({ allowed: false, retryAfterSeconds: 420 });
        jest
          .spyOn(Logger.prototype, 'warn')
          .mockImplementation(() => undefined);
        const getByEmailSpy = jest.spyOn(userService, 'getByEmail');

        // Act
        const result = authService.login(req, ip);

        // Assert
        await expect(result).rejects.toMatchObject({
          code: ApiCode.LoginRateLimited,
          data: { retryAfterSeconds: 420 },
        });
        await expect(result).rejects.toHaveProperty('status', 429);
        // Checked before the lookup, so a blocked response never reveals whether the email exists.
        expect(getByEmailSpy).not.toHaveBeenCalled();
        expect(
          jest.spyOn(rateLimitService, 'refundLogin'),
        ).not.toHaveBeenCalled();
        expect(
          jest.spyOn(sessionService, 'saveCurrentSession'),
        ).not.toHaveBeenCalled();
      });

      it('被擋時記 warn，帶 ip 與秒數，不記 email', async () => {
        // Arrange
        jest
          .spyOn(rateLimitService, 'hitLogin')
          .mockResolvedValue({ allowed: false, retryAfterSeconds: 420 });
        const loggerWarn = jest
          .spyOn(Logger.prototype, 'warn')
          .mockImplementation(() => undefined);

        // Act
        await authService.login(req, ip).catch(() => undefined);

        // Assert
        expect(loggerWarn).toHaveBeenCalledWith(
          {
            event: LOG_EVENTS.authLoginRateLimited,
            ip,
            retryAfterSeconds: 420,
          },
          '登入嘗試次數過多',
        );
        expect(JSON.stringify(loggerWarn.mock.calls)).not.toContain(req.email);
      });

      it('Redis 故障時直接丟出（fail-closed），不繼續登入', async () => {
        // Arrange
        const redisError = new Error('Redis unavailable');
        jest.spyOn(rateLimitService, 'hitLogin').mockRejectedValue(redisError);
        const getByEmailSpy = jest.spyOn(userService, 'getByEmail');

        // Act
        const result = authService.login(req, ip);

        // Assert
        await expect(result).rejects.toBe(redisError);
        expect(getByEmailSpy).not.toHaveBeenCalled();
      });

      it('非 LOCAL 帳號視為失敗，不退回', async () => {
        // Arrange
        jest.spyOn(userService, 'getByEmail').mockResolvedValue({
          ...pendingUser,
          authProvider: 'GOOGLE',
          passwordHash: null,
        });

        // Act
        const result = await authService.login(req, ip);

        // Assert
        expect(result).toBeNull();
        expect(
          jest.spyOn(rateLimitService, 'refundLogin'),
        ).not.toHaveBeenCalled();
      });
    });
  });

  /** 登出 */
  describe('logout', () => {
    it('撤銷 Session 後，以它的 familyId 斷開同一次登入的 Socket', async () => {
      const sessionId = 'sessionId';
      const revokeSessionSpy = jest
        .spyOn(sessionService, 'revokeSession')
        .mockResolvedValue('family-1');
      const disconnectFamilySpy = jest.spyOn(socketService, 'disconnectFamily');

      await authService.logout(sessionId);

      expect(revokeSessionSpy).toHaveBeenCalledWith(sessionId);
      expect(disconnectFamilySpy).toHaveBeenCalledTimes(1);
      expect(disconnectFamilySpy).toHaveBeenCalledWith('family-1');
    });

    it('Session 已不存在時不斷開任何 Socket', async () => {
      jest.spyOn(sessionService, 'revokeSession').mockResolvedValue(null);
      const disconnectFamilySpy = jest.spyOn(socketService, 'disconnectFamily');

      await authService.logout('sessionId');

      expect(disconnectFamilySpy).not.toHaveBeenCalled();
    });
  });
});
