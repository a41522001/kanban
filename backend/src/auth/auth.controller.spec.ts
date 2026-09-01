import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import type { Response, Request } from 'express';
import { AppException } from '@/common/exceptions/app.exception';
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
        message: '註冊成功',
      };
      const spy = jest.spyOn(authService, 'signup').mockResolvedValue(true);
      const result = await controller.signup(req);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(req);
      expect(result).toEqual(res);
    });
    it('註冊失敗', async () => {
      const spy = jest.spyOn(authService, 'signup').mockResolvedValue(false);
      await expect(controller.signup(req)).rejects.toThrow('Email 已被註冊');
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

        expect(error.code).toBe(0);
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
});
