import { HttpStatus, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiCode } from '@kanban/contracts/api';
import { AvatarStorageUnavailableException } from '@/common/exceptions/avatar.exception';
import type { Avatar } from '@/generated/prisma/client';
import { QueueService } from '@/infrastructure/queue/queue.service';
import {
  MEDIA_STORAGE,
  TEMP_STORAGE,
} from '@/infrastructure/storage/storage.tokens';
import type { StorageService } from '@/infrastructure/storage/storage.types';
import { AvatarRepository } from './avatar.repository';
import { AvatarService } from './avatar.service';
import { ImageProcessingService } from './image/imageProcessing.service';

const userId = '6b3a1c4e-2f0d-4a8b-9c7e-1d2f3a4b5c6d';
const input = Buffer.from('original');
const mediumWebp = Buffer.from('medium-webp');
const existingUploadId = '9f8e7d6c-5b4a-4321-8fed-cba987654321';
const existingDir = `avatars/${existingUploadId}/`;

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

/** 503 必須帶上原始錯誤（cause）與事件代號（event），交給全域 Filter 統一記錄。 */
const expectStorageUnavailable = (
  error: unknown,
  expected: { event: string; cause: Error },
): void => {
  expect(error).toBeInstanceOf(AvatarStorageUnavailableException);
  const exception = error as AvatarStorageUnavailableException;
  expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  expect(exception.code).toBe(ApiCode.AvatarStorageUnavailable);
  expect(exception.event).toBe(expected.event);
  expect(exception.cause).toBe(expected.cause);
};

describe('AvatarService', () => {
  let avatarService: AvatarService;
  let upsertCurrent: jest.MockedFunction<AvatarRepository['upsertCurrent']>;
  let findByUserId: jest.MockedFunction<AvatarRepository['findByUserId']>;
  let deleteByUserId: jest.MockedFunction<AvatarRepository['deleteByUserId']>;
  let mediaWrite: jest.MockedFunction<StorageService['write']>;
  let mediaDeleteDir: jest.MockedFunction<StorageService['deleteDir']>;
  let tempWrite: jest.MockedFunction<StorageService['write']>;
  let tempDeleteDir: jest.MockedFunction<StorageService['deleteDir']>;
  let addAvatarQueue: jest.MockedFunction<QueueService['addAvatarQueue']>;
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

  /** 從 media 的第一次寫入取出 md 的 key、uploadId 與資料夾。 */
  const getUpload = (): { key: string; uploadId: string; dir: string } => {
    const [key] = mediaWrite.mock.calls[0];
    const uploadId = key.split('/')[1];
    return { key, uploadId, dir: `avatars/${uploadId}/` };
  };

  /** media 與 temp 都刪除了同一個資料夾，且各只刪一次。 */
  const expectBothDirsDeleted = (dir: string): void => {
    expect(mediaDeleteDir).toHaveBeenCalledTimes(1);
    expect(mediaDeleteDir).toHaveBeenCalledWith(dir);
    expect(tempDeleteDir).toHaveBeenCalledTimes(1);
    expect(tempDeleteDir).toHaveBeenCalledWith(dir);
  };

  const createStorageMock = (
    write: jest.MockedFunction<StorageService['write']>,
    deleteDir: jest.MockedFunction<StorageService['deleteDir']>,
  ) => ({
    write,
    read: jest.fn(),
    deleteDir,
    listDirs: jest.fn(),
    getPublicUrl: (key: string) => `/media/${key}`,
  });

  beforeEach(async () => {
    // Silence expected error logs and let tests assert on them.
    loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    upsertCurrent = jest.fn().mockResolvedValue(undefined);
    findByUserId = jest.fn().mockResolvedValue(null);
    deleteByUserId = jest.fn().mockResolvedValue(1);
    mediaWrite = jest.fn().mockResolvedValue(undefined);
    mediaDeleteDir = jest.fn().mockResolvedValue(undefined);
    tempWrite = jest.fn().mockResolvedValue(undefined);
    tempDeleteDir = jest.fn().mockResolvedValue(undefined);
    addAvatarQueue = jest.fn().mockResolvedValue(undefined);

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
          useValue: createStorageMock(mediaWrite, mediaDeleteDir),
        },
        {
          provide: TEMP_STORAGE,
          useValue: createStorageMock(tempWrite, tempDeleteDir),
        },
        {
          provide: QueueService,
          useValue: { addAvatarQueue },
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

      const { key, uploadId } = getUpload();
      expect(key).toMatch(/^avatars\/[0-9a-f-]{36}\/md\.webp$/);
      expect(mediaWrite).toHaveBeenCalledWith(key, mediumWebp, 'image/webp');
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

    it('原圖寫入 temp，key 不含副檔名，content type 使用 Sharp 判斷的真實格式', async () => {
      await avatarService.upload(userId, input);

      const { uploadId } = getUpload();
      expect(tempWrite).toHaveBeenCalledWith(
        `avatars/${uploadId}/original`,
        input,
        'image/png',
      );
      // The original must never be written to public media storage.
      expect(mediaWrite).toHaveBeenCalledTimes(1);
    });

    it('寫入 md 失敗時丟 503，不寫原圖、不 upsert，並清除兩邊的資料夾', async () => {
      const cause = new Error('ENOSPC');
      mediaWrite.mockRejectedValue(cause);

      const error = await catchUploadError();

      expectStorageUnavailable(error, {
        event: 'avatar.upload.write_failed',
        cause,
      });
      expect(tempWrite).not.toHaveBeenCalled();
      expect(upsertCurrent).not.toHaveBeenCalled();
      expectBothDirsDeleted(getUpload().dir);
      // 由全域 Filter 記錄，service 不重複記
      expect(loggerError).not.toHaveBeenCalled();
    });

    it('寫入原圖失敗時丟 503，不 upsert，並清除已寫入的 md', async () => {
      const cause = new Error('ENOSPC');
      tempWrite.mockRejectedValue(cause);

      const error = await catchUploadError();

      expectStorageUnavailable(error, {
        event: 'avatar.upload.write_failed',
        cause,
      });
      expect(upsertCurrent).not.toHaveBeenCalled();
      expectBothDirsDeleted(getUpload().dir);
      expect(loggerError).not.toHaveBeenCalled();
    });

    it('upsert 失敗時丟 503，並清除兩邊剛寫入的資料夾', async () => {
      const cause = new Error('DB down');
      upsertCurrent.mockRejectedValue(cause);

      const error = await catchUploadError();

      expectStorageUnavailable(error, {
        event: 'avatar.upload.save_failed',
        cause,
      });
      expectBothDirsDeleted(getUpload().dir);
      expect(loggerError).not.toHaveBeenCalled();
    });

    it('upsert 與刪檔都失敗時仍丟 503，不被刪檔錯誤蓋掉', async () => {
      const cause = new Error('DB down');
      upsertCurrent.mockRejectedValue(cause);
      mediaDeleteDir.mockRejectedValue(new Error('EPERM'));
      tempDeleteDir.mockRejectedValue(new Error('EPERM'));

      const error = await catchUploadError();

      // cause 仍是 upsert 的錯誤，不是刪檔錯誤
      expectStorageUnavailable(error, {
        event: 'avatar.upload.save_failed',
        cause,
      });
      // 只有清理失敗（接住後不再丟出）由 service 記錄：media、temp 各一筆
      expect(loggerError).toHaveBeenCalledTimes(2);
    });

    it('media 刪除失敗時仍會繼續刪除 temp', async () => {
      upsertCurrent.mockRejectedValue(new Error('DB down'));
      mediaDeleteDir.mockRejectedValue(new Error('EPERM'));

      await catchUploadError();

      expect(tempDeleteDir).toHaveBeenCalledWith(getUpload().dir);
    });

    it('查詢舊頭像失敗時丟 503，不 upsert，並清除兩邊剛寫入的資料夾', async () => {
      const cause = new Error('DB down');
      findByUserId.mockRejectedValue(cause);

      const error = await catchUploadError();

      expectStorageUnavailable(error, {
        event: 'avatar.upload.save_failed',
        cause,
      });
      expect(upsertCurrent).not.toHaveBeenCalled();
      expectBothDirsDeleted(getUpload().dir);
    });

    it('第一次上傳（沒有舊頭像）時不刪任何資料夾', async () => {
      await avatarService.upload(userId, input);

      expect(mediaDeleteDir).not.toHaveBeenCalled();
      expect(tempDeleteDir).not.toHaveBeenCalled();
    });

    it('有舊頭像時，upsert 成功後只刪除兩邊的舊資料夾', async () => {
      findByUserId.mockResolvedValue(createAvatar());

      await avatarService.upload(userId, input);

      expectBothDirsDeleted(existingDir);
      // Old files must be removed only after the DB points to the new upload.
      expect(upsertCurrent.mock.invocationCallOrder[0]).toBeLessThan(
        mediaDeleteDir.mock.invocationCallOrder[0],
      );
    });

    it('刪除舊資料夾失敗時仍回傳成功，且不刪新資料夾', async () => {
      findByUserId.mockResolvedValue(createAvatar());
      mediaDeleteDir.mockRejectedValue(new Error('EPERM'));

      const result = await avatarService.upload(userId, input);

      expect(result.mediumUrl).toBe(`/media/${getUpload().key}`);
      expectBothDirsDeleted(existingDir);
      expect(loggerError).toHaveBeenCalledTimes(1);
    });

    it('有舊頭像但 upsert 失敗時，保留舊資料夾', async () => {
      findByUserId.mockResolvedValue(createAvatar());
      upsertCurrent.mockRejectedValue(new Error('DB down'));

      await catchUploadError();

      expectBothDirsDeleted(getUpload().dir);
    });

    it('upsert 成功後以 userId 與 uploadId 入列', async () => {
      await avatarService.upload(userId, input);

      const { uploadId } = getUpload();
      expect(addAvatarQueue).toHaveBeenCalledWith({ userId, uploadId });
      // The worker checks the DB first, so the row must exist before the job.
      expect(upsertCurrent.mock.invocationCallOrder[0]).toBeLessThan(
        addAvatarQueue.mock.invocationCallOrder[0],
      );
    });

    it('入列失敗時只記 log，仍回傳 md（不丟錯）', async () => {
      addAvatarQueue.mockRejectedValue(new Error('Redis down'));

      const result = await avatarService.upload(userId, input);

      expect(result.mediumUrl).toBe(`/media/${getUpload().key}`);
      expect(mediaDeleteDir).not.toHaveBeenCalled();
      expect(tempDeleteDir).not.toHaveBeenCalled();
      expect(loggerError).toHaveBeenCalledTimes(1);
    });

    it('upsert 失敗時不入列', async () => {
      upsertCurrent.mockRejectedValue(new Error('DB down'));

      await catchUploadError();

      expect(addAvatarQueue).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('有頭像時刪除 DB row 與兩邊的資料夾', async () => {
      findByUserId.mockResolvedValue(createAvatar());

      await avatarService.remove(userId);

      expect(deleteByUserId).toHaveBeenCalledWith(userId);
      expectBothDirsDeleted(existingDir);
    });

    it('沒有頭像時直接結束，不刪 DB 也不刪檔（冪等）', async () => {
      await expect(avatarService.remove(userId)).resolves.toBeUndefined();

      expect(deleteByUserId).not.toHaveBeenCalled();
      expect(mediaDeleteDir).not.toHaveBeenCalled();
      expect(tempDeleteDir).not.toHaveBeenCalled();
    });

    it('DB row 已被其他請求刪除（count 為 0）時不刪檔', async () => {
      findByUserId.mockResolvedValue(createAvatar());
      deleteByUserId.mockResolvedValue(0);

      await avatarService.remove(userId);

      expect(mediaDeleteDir).not.toHaveBeenCalled();
      expect(tempDeleteDir).not.toHaveBeenCalled();
    });

    it('刪資料夾失敗時只記 log，不丟錯', async () => {
      findByUserId.mockResolvedValue(createAvatar());
      mediaDeleteDir.mockRejectedValue(new Error('EPERM'));

      await expect(avatarService.remove(userId)).resolves.toBeUndefined();

      expect(tempDeleteDir).toHaveBeenCalledWith(existingDir);
      expect(loggerError).toHaveBeenCalledTimes(1);
    });
  });
});
