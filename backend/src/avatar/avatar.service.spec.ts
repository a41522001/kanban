import { HttpStatus, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiCode } from '@kanban/contracts/api';
import { AvatarStorageUnavailableException } from '@/common/exceptions/avatar.exception';
import type { Avatar } from '@/generated/prisma/client';
import { MEDIA_STORAGE } from '@/storage/storage.tokens';
import type { StorageService } from '@/storage/storage.types';
import { AvatarRepository } from './avatar.repository';
import { AvatarService } from './avatar.service';
import { ImageProcessingService } from './image/imageProcessing.service';

const userId = '6b3a1c4e-2f0d-4a8b-9c7e-1d2f3a4b5c6d';
const input = Buffer.from('original');
const mediumWebp = Buffer.from('medium-webp');
const existingUploadId = '9f8e7d6c-5b4a-4321-8fed-cba987654321';

/** 使用者目前已有的頭像（upload 時為舊頭像，remove 時為要刪除的頭像）。 */
const createAvatar = (): Avatar => ({
  userId,
  uploadId: existingUploadId,
  mediumUrl: `/media/avatars/${existingUploadId}/md.webp`,
  smallUrl: null,
  largeUrl: null,
  variantStatus: 'PENDING',
  variantAttempts: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const expectStorageUnavailable = (error: unknown): void => {
  expect(error).toBeInstanceOf(AvatarStorageUnavailableException);
  const exception = error as AvatarStorageUnavailableException;
  expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  expect(exception.code).toBe(ApiCode.AvatarStorageUnavailable);
};

describe('AvatarService', () => {
  let avatarService: AvatarService;
  let upsertCurrent: jest.MockedFunction<AvatarRepository['upsertCurrent']>;
  let findByUserId: jest.MockedFunction<AvatarRepository['findByUserId']>;
  let deleteByUserId: jest.MockedFunction<AvatarRepository['deleteByUserId']>;
  let write: jest.MockedFunction<StorageService['write']>;
  let deleteDir: jest.MockedFunction<StorageService['deleteDir']>;
  let loggerError: jest.SpyInstance;

  /** 取得 upload 丟出的錯誤，方便同時檢查型別、狀態碼與 code。 */
  const catchUploadError = async (): Promise<unknown> => {
    try {
      await avatarService.upload(userId, input);
    } catch (error) {
      return error;
    }
    throw new Error('Expected upload to throw');
  };

  /** 從 write 的第一次呼叫取出 storage key 與 uploadId。 */
  const getWrittenKey = (): { key: string; uploadId: string } => {
    const [key] = write.mock.calls[0];
    return { key, uploadId: key.split('/')[1] };
  };

  beforeEach(async () => {
    // Silence expected error logs and let tests assert on them.
    loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    upsertCurrent = jest.fn().mockResolvedValue(undefined);
    findByUserId = jest.fn().mockResolvedValue(null);
    deleteByUserId = jest.fn().mockResolvedValue(1);
    write = jest.fn().mockResolvedValue(undefined);
    deleteDir = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvatarService,
        {
          provide: AvatarRepository,
          useValue: { upsertCurrent, findByUserId, deleteByUserId },
        },
        {
          provide: ImageProcessingService,
          useValue: {
            validate: jest.fn().mockResolvedValue({
              format: 'png',
              width: 512,
              height: 512,
            }),
            render: jest.fn().mockResolvedValue(mediumWebp),
          },
        },
        {
          provide: MEDIA_STORAGE,
          useValue: {
            write,
            read: jest.fn(),
            deleteDir,
            listDirs: jest.fn(),
            getPublicUrl: (key: string) => `/media/${key}`,
          },
        },
      ],
    }).compile();

    avatarService = module.get(AvatarService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('upload', () => {
    it('寫入 md 檔並 upsert 後回傳 mediumUrl，small/large 為 null', async () => {
      const result = await avatarService.upload(userId, input);

      const { key, uploadId } = getWrittenKey();
      expect(key).toMatch(/^avatars\/[0-9a-f-]{36}\/md\.webp$/);
      expect(write).toHaveBeenCalledWith(key, mediumWebp, 'image/webp');
      expect(upsertCurrent).toHaveBeenCalledWith({
        userId,
        uploadId,
        mediumUrl: `/media/${key}`,
      });
      expect(result).toEqual({
        smallUrl: null,
        mediumUrl: `/media/${key}`,
        largeUrl: null,
      });
    });

    it('寫檔失敗時丟 503 / AvatarStorageUnavailable，且不 upsert', async () => {
      write.mockRejectedValue(new Error('ENOSPC'));

      const error = await catchUploadError();

      expectStorageUnavailable(error);
      expect(upsertCurrent).not.toHaveBeenCalled();
      expect(loggerError).toHaveBeenCalledTimes(1);
    });

    it('upsert 失敗時丟 503，並刪除剛寫入的資料夾', async () => {
      upsertCurrent.mockRejectedValue(new Error('DB down'));

      const error = await catchUploadError();

      expectStorageUnavailable(error);
      const { uploadId } = getWrittenKey();
      expect(deleteDir).toHaveBeenCalledWith(`avatars/${uploadId}/`);
      expect(loggerError).toHaveBeenCalledTimes(1);
    });

    it('upsert 與刪檔都失敗時仍丟 503，不被刪檔錯誤蓋掉', async () => {
      upsertCurrent.mockRejectedValue(new Error('DB down'));
      deleteDir.mockRejectedValue(new Error('EPERM'));

      const error = await catchUploadError();

      expectStorageUnavailable(error);
      expect(loggerError).toHaveBeenCalledTimes(2);
    });

    it('查詢舊頭像失敗時丟 503，不 upsert，並刪除剛寫入的資料夾', async () => {
      findByUserId.mockRejectedValue(new Error('DB down'));

      const error = await catchUploadError();

      expectStorageUnavailable(error);
      expect(upsertCurrent).not.toHaveBeenCalled();
      const { uploadId } = getWrittenKey();
      expect(deleteDir).toHaveBeenCalledWith(`avatars/${uploadId}/`);
    });

    it('第一次上傳（沒有舊頭像）時不刪任何資料夾', async () => {
      await avatarService.upload(userId, input);

      expect(deleteDir).not.toHaveBeenCalled();
    });

    it('有舊頭像時，upsert 成功後只刪除舊資料夾', async () => {
      findByUserId.mockResolvedValue(createAvatar());

      await avatarService.upload(userId, input);

      expect(deleteDir).toHaveBeenCalledTimes(1);
      expect(deleteDir).toHaveBeenCalledWith(`avatars/${existingUploadId}/`);
      // Old files must be removed only after the DB points to the new upload.
      expect(upsertCurrent.mock.invocationCallOrder[0]).toBeLessThan(
        deleteDir.mock.invocationCallOrder[0],
      );
    });

    it('刪除舊資料夾失敗時仍回傳成功，且不刪新資料夾', async () => {
      findByUserId.mockResolvedValue(createAvatar());
      deleteDir.mockRejectedValue(new Error('EPERM'));

      const result = await avatarService.upload(userId, input);

      const { key } = getWrittenKey();
      expect(result.mediumUrl).toBe(`/media/${key}`);
      expect(deleteDir).toHaveBeenCalledTimes(1);
      expect(deleteDir).toHaveBeenCalledWith(`avatars/${existingUploadId}/`);
      expect(loggerError).toHaveBeenCalledTimes(1);
    });

    it('有舊頭像但 upsert 失敗時，保留舊資料夾', async () => {
      findByUserId.mockResolvedValue(createAvatar());
      upsertCurrent.mockRejectedValue(new Error('DB down'));

      await catchUploadError();

      const { uploadId } = getWrittenKey();
      expect(deleteDir).toHaveBeenCalledTimes(1);
      expect(deleteDir).toHaveBeenCalledWith(`avatars/${uploadId}/`);
    });
  });

  describe('remove', () => {
    const uploadId = existingUploadId;

    it('有頭像時刪除 DB row 與該 uploadId 的資料夾', async () => {
      findByUserId.mockResolvedValue(createAvatar());

      await avatarService.remove(userId);

      expect(deleteByUserId).toHaveBeenCalledWith(userId);
      expect(deleteDir).toHaveBeenCalledWith(`avatars/${uploadId}/`);
    });

    it('沒有頭像時直接結束，不刪 DB 也不刪檔（冪等）', async () => {
      await expect(avatarService.remove(userId)).resolves.toBeUndefined();

      expect(deleteByUserId).not.toHaveBeenCalled();
      expect(deleteDir).not.toHaveBeenCalled();
    });

    it('DB row 已被其他請求刪除（count 為 0）時不刪檔', async () => {
      findByUserId.mockResolvedValue(createAvatar());
      deleteByUserId.mockResolvedValue(0);

      await avatarService.remove(userId);

      expect(deleteDir).not.toHaveBeenCalled();
    });

    it('刪資料夾失敗時只記 log，不丟錯', async () => {
      findByUserId.mockResolvedValue(createAvatar());
      deleteDir.mockRejectedValue(new Error('EPERM'));

      await expect(avatarService.remove(userId)).resolves.toBeUndefined();

      expect(loggerError).toHaveBeenCalledTimes(1);
    });
  });
});
