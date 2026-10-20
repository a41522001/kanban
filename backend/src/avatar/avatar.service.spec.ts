import { HttpStatus, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiCode } from '@kanban/contracts/api';
import { AvatarStorageUnavailableException } from '@/common/exceptions/avatar.exception';
import { MEDIA_STORAGE } from '@/storage/storage.tokens';
import type { StorageService } from '@/storage/storage.types';
import { AvatarRepository } from './avatar.repository';
import { AvatarService } from './avatar.service';
import { ImageProcessingService } from './image/imageProcessing.service';

const userId = '6b3a1c4e-2f0d-4a8b-9c7e-1d2f3a4b5c6d';
const input = Buffer.from('original');
const mediumWebp = Buffer.from('medium-webp');

const expectStorageUnavailable = (error: unknown): void => {
  expect(error).toBeInstanceOf(AvatarStorageUnavailableException);
  const exception = error as AvatarStorageUnavailableException;
  expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  expect(exception.code).toBe(ApiCode.AvatarStorageUnavailable);
};

describe('AvatarService', () => {
  let avatarService: AvatarService;
  let upsertCurrent: jest.MockedFunction<AvatarRepository['upsertCurrent']>;
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
    write = jest.fn().mockResolvedValue(undefined);
    deleteDir = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvatarService,
        {
          provide: AvatarRepository,
          useValue: { upsertCurrent },
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
  });
});
