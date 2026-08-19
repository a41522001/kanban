import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { SessionService } from '@/session/session.service';
import bcrypt from 'bcrypt';
describe('AuthService', () => {
  let authService: AuthService;
  let sessionService: SessionService;
  let repository: jest.Mocked<AuthRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue(4),
          },
        },
        {
          provide: SessionService,
          useValue: {
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: AuthRepository,
          useValue: {
            create: jest.fn(),
            getByEmail: jest.fn(),
            getById: jest.fn(),
            updateUserName: jest.fn(),
            updateAvatar: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    sessionService = module.get<SessionService>(SessionService);
    repository = module.get(AuthRepository);
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
        .spyOn(repository, 'getByEmail')
        .mockResolvedValue(null);
      const createSpy = jest
        .spyOn(repository, 'create')
        .mockResolvedValue(undefined);

      const result = await authService.signup(req);
      expect(result).toBe(true);
      expect(getByEmailSpy).toHaveBeenCalledWith(req.email);
      expect(getByEmailSpy).toHaveBeenCalledTimes(1);

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith({
        email: req.email,
        displayName: req.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        passwordHash: expect.any(String),
      });
    });

    it('註冊失敗, 使用者已存在', async () => {
      const getByEmailSpy = jest
        .spyOn(repository, 'getByEmail')
        .mockResolvedValue({
          id: '1',
          displayName: req.name,
          email: req.email,
          passwordHash: 'hashed-password',
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      const createSpy = jest.spyOn(repository, 'create');
      const result = await authService.signup(req);
      expect(result).toBe(false);
      expect(getByEmailSpy).toHaveBeenCalledWith(req.email);
      expect(getByEmailSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).not.toHaveBeenCalled();
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
        .spyOn(repository, 'getByEmail')
        .mockResolvedValue(null);
      const saveSpy = jest.spyOn(sessionService, 'save');
      const result = await authService.login(req);
      expect(result).toBeNull();
      expect(getByEmailSpy).toHaveBeenCalledWith(req.email);
      expect(getByEmailSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('密碼錯誤', async () => {
      const wrongPasswordHash = await bcrypt.hash('another-password', 4);
      const getByEmailSpy = jest
        .spyOn(repository, 'getByEmail')
        .mockResolvedValue({
          id: '1',
          displayName: 'test',
          email: req.email,
          passwordHash: wrongPasswordHash,
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      const saveSpy = jest.spyOn(sessionService, 'save');
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
        .spyOn(repository, 'getByEmail')
        .mockResolvedValue({
          id: userId,
          displayName: 'test',
          email: req.email,
          passwordHash,
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      const saveSpy = jest
        .spyOn(sessionService, 'save')
        .mockResolvedValue(sessionId);
      const result = await authService.login(req);
      expect(getByEmailSpy).toHaveBeenCalledWith(req.email);
      expect(getByEmailSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledWith(userId);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(result).toBe(sessionId);
    });
  });
  /** 取得UserInfo */
  describe('userInfo', () => {
    it('取得成功', async () => {
      const mockUser = {
        id: '1',
        displayName: 'test',
        email: 'test@test.com',
      };
      const user = {
        ...mockUser,
        passwordHash: 'passwordHash',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const getById = jest.spyOn(repository, 'getById').mockResolvedValue(user);
      const result = await authService.getUserInfo(mockUser.id);
      expect(result!.email).toBe(mockUser.email);
      expect(result!.displayName).toBe(mockUser.displayName);
      expect(getById).toHaveBeenCalledTimes(1);
      expect(getById).toHaveBeenCalledWith(mockUser.id);
    });

    it('取得失敗', async () => {
      const userId = '';
      const getById = jest.spyOn(repository, 'getById').mockResolvedValue(null);
      const result = await authService.getUserInfo(userId);
      expect(result).toBeNull();
      expect(getById).toHaveBeenCalledTimes(1);
      expect(getById).toHaveBeenCalledWith(userId);
    });
  });
  /** 登出 */
  describe('logout', () => {
    it('登出', async () => {
      const sessionId = 'sessionId';
      const deleteSession = jest.spyOn(sessionService, 'delete');
      await authService.logout(sessionId);
      expect(deleteSession).toHaveBeenCalledTimes(1);
      expect(deleteSession).toHaveBeenCalledWith(sessionId);
    });
  });
});
