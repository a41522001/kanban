import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { Avatar } from '@/generated/prisma/client';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';

type UserWithAvatar = NonNullable<
  Awaited<ReturnType<UserRepository['getById']>>
>;

const userId = '6b3a1c4e-2f0d-4a8b-9c7e-1d2f3a4b5c6d';
const uploadId = '9f8e7d6c-5b4a-4321-8fed-cba987654321';

const createUser = (avatar: Avatar | null): UserWithAvatar => ({
  id: userId,
  email: 'test@test.com',
  displayName: 'test',
  passwordHash: 'passwordHash',
  authProvider: 'LOCAL',
  emailVerifiedAt: null,
  googleSub: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  avatar,
});

const createAvatar = (overrides: Partial<Avatar> = {}): Avatar => ({
  userId,
  uploadId,
  mediumUrl: `http://localhost:4001/media/avatars/${uploadId}/md.webp`,
  smallUrl: null,
  largeUrl: null,
  variantStatus: 'PENDING',
  variantAttempts: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

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
          provide: UserRepository,
          useValue: {
            create: jest.fn(),
            getByEmail: jest.fn(),
            getById: jest.fn(),
            updateUserName: jest.fn(),
          },
        },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
    userRepository = module.get(UserRepository);
  });

  /** 取得UserInfo */
  describe('getUserInfo', () => {
    it('沒有頭像時 avatar 為 null', async () => {
      // Arrange
      const getById = jest
        .spyOn(userRepository, 'getById')
        .mockResolvedValue(createUser(null));

      // Act
      const result = await userService.getUserInfo(userId);

      // Assert
      expect(result).toEqual({
        email: 'test@test.com',
        displayName: 'test',
        avatar: null,
      });
      expect(getById).toHaveBeenCalledTimes(1);
      expect(getById).toHaveBeenCalledWith(userId);
    });

    it('背景尺寸尚未完成時，只有 mediumUrl 有值', async () => {
      // Arrange
      const avatar = createAvatar();
      jest
        .spyOn(userRepository, 'getById')
        .mockResolvedValue(createUser(avatar));

      // Act
      const result = await userService.getUserInfo(userId);

      // Assert
      expect(result?.avatar).toEqual({
        smallUrl: null,
        mediumUrl: avatar.mediumUrl,
        largeUrl: null,
      });
    });

    it('三個尺寸都完成時，回傳全部網址', async () => {
      // Arrange
      const base = `http://localhost:4001/media/avatars/${uploadId}`;
      const avatar = createAvatar({
        smallUrl: `${base}/sm.webp`,
        largeUrl: `${base}/lg.webp`,
        variantStatus: 'COMPLETED',
      });
      jest
        .spyOn(userRepository, 'getById')
        .mockResolvedValue(createUser(avatar));

      // Act
      const result = await userService.getUserInfo(userId);

      // Assert
      expect(result?.avatar).toEqual({
        smallUrl: `${base}/sm.webp`,
        mediumUrl: `${base}/md.webp`,
        largeUrl: `${base}/lg.webp`,
      });
    });

    it('不外露 userId、uploadId 與背景處理狀態', async () => {
      // Arrange
      jest
        .spyOn(userRepository, 'getById')
        .mockResolvedValue(createUser(createAvatar()));

      // Act
      const result = await userService.getUserInfo(userId);

      // Assert
      expect(Object.keys(result!).sort()).toEqual([
        'avatar',
        'displayName',
        'email',
      ]);
      expect(Object.keys(result!.avatar!).sort()).toEqual([
        'largeUrl',
        'mediumUrl',
        'smallUrl',
      ]);
      expect(JSON.stringify(result)).not.toContain(userId);
    });

    it('找不到使用者時回傳 null', async () => {
      // Arrange
      const getById = jest
        .spyOn(userRepository, 'getById')
        .mockResolvedValue(null);

      // Act
      const result = await userService.getUserInfo(userId);

      // Assert
      expect(result).toBeNull();
      expect(getById).toHaveBeenCalledWith(userId);
    });
  });
});
