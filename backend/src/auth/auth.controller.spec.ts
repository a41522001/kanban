import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import type { Response } from 'express';
describe('authController', () => {
  let authService: AuthService;
  let controller: AuthController;
  const createResponse = (data: any): Response => {
    const cookie = jest.fn();
    return { ...data, cookie } as Response;
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('development'),
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
      const res = createResponse({});
      const spy = jest.spyOn(authService, 'login').mockResolvedValue(sessionId);
      const result = await controller.login(req, res);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(req);
      expect(result).toEqual({ message: '登入成功' });
    });
  });
});
