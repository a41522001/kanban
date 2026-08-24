import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { SessionService } from '@/session/session.service';
import { ConfigService } from '@nestjs/config';

describe('UserService', () => {
  let userService: UserService;
  let userRepository: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
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
          provide: UserRepository,
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

    userService = module.get<UserService>(UserService);
    userRepository = module.get(UserRepository);
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
      const getById = jest
        .spyOn(userRepository, 'getById')
        .mockResolvedValue(user);
      const result = await userService.getUserInfo(mockUser.id);
      expect(result!.email).toBe(mockUser.email);
      expect(result!.displayName).toBe(mockUser.displayName);
      expect(getById).toHaveBeenCalledTimes(1);
      expect(getById).toHaveBeenCalledWith(mockUser.id);
    });

    it('取得失敗', async () => {
      const userId = '';
      const getById = jest
        .spyOn(userRepository, 'getById')
        .mockResolvedValue(null);
      const result = await userService.getUserInfo(userId);
      expect(result).toBeNull();
      expect(getById).toHaveBeenCalledTimes(1);
      expect(getById).toHaveBeenCalledWith(userId);
    });
  });
});
