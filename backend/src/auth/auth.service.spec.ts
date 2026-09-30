import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SessionService } from '@/session/session.service';
import bcrypt from 'bcrypt';
import { UserService } from '@/user/user.service';
import { SocketService } from '@/socket/socket.service';
import { RedisService } from '@/redis/redis.service';
import { QueueService } from '@/queue/queue.service';
import { ApiCode } from '@kanban/contracts/api';
import type { User } from '@/generated/prisma/client';
describe('AuthService', () => {
  let authService: AuthService;
  let userService: UserService;
  let sessionService: SessionService;
  let socketService: SocketService;
  let queueService: QueueService;
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
            getOrThrow: jest.fn((key: string) =>
              key === 'RATE_LIMIT_VERIFY_EMAIL_SECONDS' ? 60 : 3,
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
            disconnectSession: jest.fn(),
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
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    sessionService = module.get<SessionService>(SessionService);
    socketService = module.get<SocketService>(SocketService);
    queueService = module.get<QueueService>(QueueService);
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

      const result = await authService.signup(req);
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
      const result = await authService.signup(req);
      expect(result).toBe(false);
      expect(getByEmailSpy).toHaveBeenCalledWith(req.email);
      expect(getByEmailSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).not.toHaveBeenCalled();
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
    jest.spyOn(userService, 'getByEmail').mockResolvedValue(null);
    jest.spyOn(userService, 'createUser').mockResolvedValue(pendingUser);
    jest
      .spyOn(queueService, 'addVerificationEmailQueue')
      .mockRejectedValue(new Error('Queue unavailable'));
    redisClient.ttl.mockResolvedValue(52);
    await expect(
      authService.signup({
        email: pendingUser.email,
        password: 'testtest',
        name: 'test',
      }),
    ).resolves.toEqual({
      accountCreated: true,
      emailQueued: false,
      retryAfterSeconds: 52,
    });
  });

  it('帳號已建立後 Redis 故障，仍回傳帳號已建立', async () => {
    jest.spyOn(userService, 'getByEmail').mockResolvedValue(null);
    jest.spyOn(userService, 'createUser').mockResolvedValue(pendingUser);
    redisClient.set.mockRejectedValue(new Error('Redis unavailable'));
    redisClient.ttl.mockRejectedValue(new Error('Redis unavailable'));
    await expect(
      authService.signup({
        email: pendingUser.email,
        password: 'testtest',
        name: 'test',
      }),
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
      jest.spyOn(userService, 'getByEmail').mockResolvedValue(pendingUser);
      jest
        .spyOn(queueService, 'addVerificationEmailQueue')
        .mockRejectedValue(new Error('Queue unavailable'));
      await expect(
        authService.resendVerificationEmail(email),
      ).rejects.toMatchObject({
        code: ApiCode.VerificationEmailQueueFailed,
        data: { retryAfterSeconds: 60 },
      });
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
      const result = await authService.login(req);
      expect(result).toBeNull();
      expect(getByEmailSpy).toHaveBeenCalledWith(req.email);
      expect(getByEmailSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).not.toHaveBeenCalled();
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
      const result = await authService.login(req);
      expect(result).toBeNull();
      expect(getByEmailSpy).toHaveBeenCalledWith(req.email);
      expect(getByEmailSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).not.toHaveBeenCalled();
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
      const result = await authService.login(req);
      expect(getByEmailSpy).toHaveBeenCalledWith(req.email);
      expect(getByEmailSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledWith(userId);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(result).toBe(sessionId);
    });

    it('密碼正確但未驗證，回傳 EmailVerificationRequired 且不建立 Session', async () => {
      const passwordHash = await bcrypt.hash(req.password, 4);
      jest
        .spyOn(userService, 'getByEmail')
        .mockResolvedValue({ ...pendingUser, passwordHash });
      await expect(authService.login(req)).rejects.toMatchObject({
        code: ApiCode.EmailVerificationRequired,
        data: { email: req.email },
      });
      expect(
        jest.spyOn(sessionService, 'saveCurrentSession'),
      ).not.toHaveBeenCalled();
    });
  });

  /** 登出 */
  describe('logout', () => {
    it('登出', async () => {
      const sessionId = 'sessionId';
      const deleteSession = jest.spyOn(sessionService, 'revokeSession');
      const disconnectSessionSpy = jest.spyOn(
        socketService,
        'disconnectSession',
      );
      await authService.logout(sessionId);
      expect(deleteSession).toHaveBeenCalledTimes(1);
      expect(deleteSession).toHaveBeenCalledWith(sessionId);
      expect(disconnectSessionSpy).toHaveBeenCalledTimes(1);
      expect(disconnectSessionSpy).toHaveBeenCalledWith(sessionId);
    });
  });
});
