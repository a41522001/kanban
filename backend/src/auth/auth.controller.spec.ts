import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import type { Response, Request } from 'express';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
describe('authController', () => {
  let authService: AuthService;
  let controller: AuthController;
  const createResponse = (): {
    response: Response;
    cookieMock: jest.Mock;
    clearCookieMock: jest.Mock;
  } => {
    const cookieMock = jest.fn();
    const clearCookieMock = jest.fn();
    const response = {
      cookie: cookieMock,
      clearCookie: clearCookieMock,
    } as unknown as Response;

    return { response, cookieMock, clearCookieMock };
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test'),
            getOrThrow: jest.fn().mockReturnValue(7),
          },
        },
        {
          provide: AuthService,
          useValue: {
            signup: jest.fn(),
            login: jest.fn(),
            logout: jest.fn(),
            verifyEmail: jest.fn(),
            resendVerificationEmail: jest.fn(),
          },
        },
      ],
    }).compile();
    controller = module.get(AuthController);
    authService = module.get(AuthService);
  });

  /** 註冊 */
  describe('signup', () => {
    const req = {
      email: 'test@test.com',
      password: 'testtest',
      name: 'test',
    };
    it('註冊成功', async () => {
      const res = {
        code: ApiCode.Success,
        message: '註冊成功',
        data: {
          accountCreated: true as const,
          emailQueued: true,
          retryAfterSeconds: 60,
        },
      };
      const spy = jest.spyOn(authService, 'signup').mockResolvedValue(res.data);
      const result = await controller.signup(req);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(req);
      expect(result).toEqual(res);
    });
    it('註冊失敗', async () => {
      const spy = jest.spyOn(authService, 'signup').mockResolvedValue(false);
      try {
        await controller.signup(req);
        throw new Error('預期註冊失敗');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(AppException);

        if (!(error instanceof AppException)) {
          throw error;
        }

        expect(error.code).toBe(ApiCode.EmailAlreadyRegistered);
        expect(error.message).toBe('Email 已被註冊');
        expect(error.getStatus()).toBe(409);
      }

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(req);
    });
  });

  /** 登入 */
  describe('login', () => {
    const req = {
      email: 'test@test.com',
      password: 'testtest',
    };
    it('登入成功', async () => {
      const sessionId = 'testsessionId';
      const { response, cookieMock } = createResponse();
      const spy = jest.spyOn(authService, 'login').mockResolvedValue(sessionId);
      const result = await controller.login(req, response);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(req);
      expect(result).toEqual({ message: '登入成功' });
      expect(cookieMock).toHaveBeenCalledWith(
        'sessionId',
        sessionId,
        expect.objectContaining({
          httpOnly: true,
        }),
      );
    });

    it('登入失敗', async () => {
      const sessionId = null;
      const { response, cookieMock } = createResponse();
      const spy = jest.spyOn(authService, 'login').mockResolvedValue(sessionId);
      try {
        await controller.login(req, response);
        throw new Error('預期登入失敗');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(AppException);

        if (!(error instanceof AppException)) {
          throw error;
        }

        expect(error.code).toBe(ApiCode.InvalidCredentials);
        expect(error.message).toBe('帳號或密碼錯誤');
        expect(error.getStatus()).toBe(401);
      }

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(req);
      expect(cookieMock).not.toHaveBeenCalled();
    });
  });

  /** 登出 */
  describe('logout', () => {
    it('登出成功', async () => {
      const { response, clearCookieMock } = createResponse();
      const sessionId = 'test';
      const req = {
        cookies: { sessionId },
      } as unknown as Request;
      const spy = jest.spyOn(authService, 'logout');
      await controller.logout(req, response);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(sessionId);
      expect(clearCookieMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('resendVerificationEmail', () => {
    const dto = { email: 'test@test.com' };

    it('受理結果提供前端倒數', async () => {
      const spy = jest
        .spyOn(authService, 'resendVerificationEmail')
        .mockResolvedValue({ retryAfterSeconds: 60 });

      await expect(controller.resendVerificationEmail(dto)).resolves.toEqual({
        message: '若此信箱有尚未驗證的帳號，我們會寄送驗證信。',
        data: { retryAfterSeconds: 60 },
      });
      expect(spy).toHaveBeenCalledWith(dto.email);
    });

    it('冷卻中回傳 429 與剩餘秒數', async () => {
      jest.spyOn(authService, 'resendVerificationEmail').mockRejectedValue(
        new AppException({
          code: ApiCode.EmailVerificationCooldown,
          message: '冷卻中，請稍後再試',
          status: 429,
          data: { retryAfterSeconds: 42 },
        }),
      );

      try {
        await controller.resendVerificationEmail(dto);
        throw new Error('預期冷卻中');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(AppException);
        if (!(error instanceof AppException)) {
          throw error;
        }
        expect(error.code).toBe(ApiCode.EmailVerificationCooldown);
        expect(error.getStatus()).toBe(429);
        expect(error.data).toEqual({ retryAfterSeconds: 42 });
      }
    });
  });

  it('帳號已建立但入列失敗，回傳專用 code 及 data', async () => {
    const data = {
      accountCreated: true as const,
      emailQueued: false,
      retryAfterSeconds: 60,
    };
    jest.spyOn(authService, 'signup').mockResolvedValue(data);
    await expect(
      controller.signup({
        email: 'test@test.com',
        password: 'testtest',
        name: 'test',
      }),
    ).resolves.toMatchObject({
      code: ApiCode.SignupEmailQueueFailed,
      data,
    });
  });

  it('未驗證登入不設定 Cookie', async () => {
    const { response, cookieMock } = createResponse();
    jest.spyOn(authService, 'login').mockRejectedValue(
      new AppException({
        code: ApiCode.EmailVerificationRequired,
        status: 403,
        message: '請先驗證信箱',
      }),
    );
    await expect(
      controller.login(
        { email: 'test@test.com', password: 'testtest' },
        response,
      ),
    ).rejects.toMatchObject({ code: ApiCode.EmailVerificationRequired });
    expect(cookieMock).not.toHaveBeenCalled();
  });

  it('無效驗證連結使用明確錯誤碼', async () => {
    jest.spyOn(authService, 'verifyEmail').mockResolvedValue(false);
    await expect(controller.verifyEmail('invalid')).rejects.toMatchObject({
      code: ApiCode.AuthVerifyFail,
      status: 400,
    });
  });

  it('驗證服務故障向外傳遞，不轉成連結無效', async () => {
    const error = new Error('DB unavailable');
    jest.spyOn(authService, 'verifyEmail').mockRejectedValue(error);
    await expect(controller.verifyEmail('token')).rejects.toBe(error);
  });
});
