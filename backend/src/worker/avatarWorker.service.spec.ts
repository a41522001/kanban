import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { type Job, UnrecoverableError } from 'bullmq';
import {
  AVATAR_WORKER_CONCURRENCY,
  type AvatarSizeKey,
} from '@/modules/avatar/avatar.constants';
import { AvatarRepository } from '@/modules/avatar/avatar.repository';
import { ImageProcessingService } from '@/modules/avatar/image/imageProcessing.service';
import { InvalidAvatarImageException } from '@/common/exceptions/avatar.exception';
import type { Avatar } from '@/generated/prisma/client';
import { RedisService } from '@/infrastructure/redis/redis.service';
import {
  MEDIA_STORAGE,
  TEMP_STORAGE,
} from '@/infrastructure/storage/storage.tokens';
import type { StorageService } from '@/infrastructure/storage/storage.types';
import type { GenerateAvatarVariantsData } from '@/common/types/queue';
import { LOG_EVENTS } from '@/common/constants/logEvents';
import { AvatarWorkerService } from './avatarWorker.service';

type Processor = (job: Job<GenerateAvatarVariantsData>) => Promise<void>;
type FailedListener = (
  job: Job<GenerateAvatarVariantsData> | undefined,
  error: Error,
) => void;
type CompletedListener = (job: Job<GenerateAvatarVariantsData>) => void;

// Capture what the service passes to `new Worker(...)` so tests can drive it
// without Redis. UnrecoverableError stays the real class.
const workerMock = {
  name: '',
  processor: undefined as Processor | undefined,
  options: undefined as Record<string, unknown> | undefined,
  failedListener: undefined as FailedListener | undefined,
  completedListener: undefined as CompletedListener | undefined,
  close: jest.fn().mockResolvedValue(undefined),
};
jest.mock('bullmq', () => ({
  ...jest.requireActual<typeof import('bullmq')>('bullmq'),
  Worker: jest.fn(
    (name: string, processor: Processor, options: Record<string, unknown>) => {
      workerMock.name = name;
      workerMock.processor = processor;
      workerMock.options = options;
      return {
        on: (event: string, listener: FailedListener | CompletedListener) => {
          if (event === 'failed') {
            workerMock.failedListener = listener as FailedListener;
          }
          if (event === 'completed') {
            workerMock.completedListener = listener as CompletedListener;
          }
        },
        close: workerMock.close,
      };
    },
  ),
}));

const userId = '6b3a1c4e-2f0d-4a8b-9c7e-1d2f3a4b5c6d';
const uploadId = '9f8e7d6c-5b4a-4321-8fed-cba987654321';
const dir = `avatars/${uploadId}/`;
const original = Buffer.from('original');
const smallWebp = Buffer.from('sm');
const largeWebp = Buffer.from('lg');

const createAvatar = (overrides: Partial<Avatar> = {}): Avatar => ({
  userId,
  uploadId,
  mediumUrl: `/media/${dir}md.webp`,
  smallUrl: null,
  largeUrl: null,
  variantStatus: 'PENDING',
  variantAttempts: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createJob = (
  overrides: Partial<Job<GenerateAvatarVariantsData>> = {},
): Job<GenerateAvatarVariantsData> =>
  ({
    id: `avatar-variants-${uploadId}`,
    queueName: 'avatar',
    name: 'generate-avatar-variants',
    attemptsStarted: 1,
    data: { userId, uploadId },
    opts: { attempts: 3 },
    attemptsMade: 1,
    failedReason: 'boom',
    ...overrides,
  }) as Job<GenerateAvatarVariantsData>;

/** Let the fire-and-forget failure handler finish. */
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('AvatarWorkerService', () => {
  let findByUserId: jest.MockedFunction<AvatarRepository['findByUserId']>;
  let completeVariants: jest.MockedFunction<
    AvatarRepository['completeVariants']
  >;
  let markVariantsFailed: jest.MockedFunction<
    AvatarRepository['markVariantsFailed']
  >;
  let render: jest.MockedFunction<ImageProcessingService['render']>;
  let mediaWrite: jest.MockedFunction<StorageService['write']>;
  let mediaDeleteDir: jest.MockedFunction<StorageService['deleteDir']>;
  let tempRead: jest.MockedFunction<StorageService['read']>;
  let tempDeleteDir: jest.MockedFunction<StorageService['deleteDir']>;
  let loggerError: jest.SpyInstance;
  let loggerLog: jest.SpyInstance;
  let loggerWarn: jest.SpyInstance;
  let service: AvatarWorkerService;

  const process = (job = createJob()) => workerMock.processor!(job);

  beforeEach(async () => {
    loggerLog = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    loggerWarn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    findByUserId = jest.fn().mockResolvedValue(createAvatar());
    completeVariants = jest.fn().mockResolvedValue(1);
    markVariantsFailed = jest.fn().mockResolvedValue(1);
    render = jest.fn((_input: Buffer, size: AvatarSizeKey) =>
      Promise.resolve<Buffer>(size === 'sm' ? smallWebp : largeWebp),
    );
    mediaWrite = jest.fn().mockResolvedValue(undefined);
    mediaDeleteDir = jest.fn().mockResolvedValue(undefined);
    tempRead = jest.fn().mockResolvedValue(original);
    tempDeleteDir = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvatarWorkerService,
        {
          provide: RedisService,
          useValue: { createBullMQConnection: () => ({}) },
        },
        {
          provide: AvatarRepository,
          useValue: { findByUserId, completeVariants, markVariantsFailed },
        },
        { provide: ImageProcessingService, useValue: { render } },
        {
          provide: MEDIA_STORAGE,
          useValue: {
            write: mediaWrite,
            deleteDir: mediaDeleteDir,
            getPublicUrl: (key: string) => `/media/${key}`,
          },
        },
        {
          provide: TEMP_STORAGE,
          useValue: { read: tempRead, deleteDir: tempDeleteDir },
        },
      ],
    }).compile();

    service = module.get(AvatarWorkerService);
    service.onModuleInit();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    workerMock.close.mockClear();
  });

  it('監聽 avatar queue，concurrency 使用常數', () => {
    expect(workerMock.name).toBe('avatar');
    expect(workerMock.options).toMatchObject({
      concurrency: AVATAR_WORKER_CONCURRENCY,
    });
  });

  describe('處理 job', () => {
    it('產生 sm／lg 寫入 media，寫回 DB 後刪除 temp 原圖', async () => {
      await process();

      expect(tempRead).toHaveBeenCalledWith(`${dir}original`);
      expect(render).toHaveBeenCalledWith(original, 'sm');
      expect(render).toHaveBeenCalledWith(original, 'lg');
      expect(mediaWrite).toHaveBeenCalledWith(
        `${dir}sm.webp`,
        smallWebp,
        'image/webp',
      );
      expect(mediaWrite).toHaveBeenCalledWith(
        `${dir}lg.webp`,
        largeWebp,
        'image/webp',
      );
      expect(completeVariants).toHaveBeenCalledWith({
        userId,
        uploadId,
        smallUrl: `/media/${dir}sm.webp`,
        largeUrl: `/media/${dir}lg.webp`,
      });
      expect(tempDeleteDir).toHaveBeenCalledWith(dir);
      expect(mediaDeleteDir).not.toHaveBeenCalled();
    });

    it.each([
      ['頭像已被刪除', null],
      ['被新上傳取代', createAvatar({ uploadId: 'another-upload' })],
    ])('%s時直接結束，不讀原圖也不寫檔', async (_label, avatar) => {
      findByUserId.mockResolvedValue(avatar);

      await process();

      expect(tempRead).not.toHaveBeenCalled();
      expect(mediaWrite).not.toHaveBeenCalled();
      expect(completeVariants).not.toHaveBeenCalled();
    });

    it.each([
      ['被新上傳取代', createAvatar({ uploadId: 'another-upload' })],
      ['頭像被刪除', null],
    ])(
      '處理途中%s（寫回 0 筆）時，刪除自己的 media 與 temp 資料夾',
      async (_label, current) => {
        // Arrange：開始處理時仍是這次上傳，寫回時已被取代或刪除。
        findByUserId
          .mockResolvedValueOnce(createAvatar())
          .mockResolvedValueOnce(current);
        completeVariants.mockResolvedValue(0);

        // Act
        await process();

        // Assert
        expect(mediaDeleteDir).toHaveBeenCalledWith(dir);
        expect(tempDeleteDir).toHaveBeenCalledWith(dir);
      },
    );

    it('同一個 job 重跑、DB 已是 COMPLETED（寫回 0 筆）時，不刪除使用中的 media', async () => {
      // Arrange：uploadId 仍相符，只是狀態已不是 PENDING。
      findByUserId
        .mockResolvedValueOnce(createAvatar())
        .mockResolvedValueOnce(createAvatar({ variantStatus: 'COMPLETED' }));
      completeVariants.mockResolvedValue(0);

      // Act
      await process();

      // Assert
      expect(mediaDeleteDir).not.toHaveBeenCalled();
      expect(tempDeleteDir).toHaveBeenCalledWith(dir);
    });

    it('寫回 0 筆後重新查詢失敗時，不刪 media、只記 log，job 不丟錯', async () => {
      // Arrange
      findByUserId
        .mockResolvedValueOnce(createAvatar())
        .mockRejectedValueOnce(new Error('DB down'));
      completeVariants.mockResolvedValue(0);

      // Act
      const act = process();

      // Assert
      await expect(act).resolves.toBeUndefined();
      expect(mediaDeleteDir).not.toHaveBeenCalled();
      expect(loggerError).toHaveBeenCalledTimes(1);
      expect(tempDeleteDir).toHaveBeenCalledWith(dir);
    });

    it('清理失敗只記 log，不丟錯（避免 BullMQ 重試整個 job）', async () => {
      // Arrange
      findByUserId
        .mockResolvedValueOnce(createAvatar())
        .mockResolvedValueOnce(createAvatar({ uploadId: 'another-upload' }));
      completeVariants.mockResolvedValue(0);
      mediaDeleteDir.mockRejectedValue(new Error('EPERM'));
      tempDeleteDir.mockRejectedValue(new Error('EPERM'));

      // Act
      const act = process();

      // Assert
      await expect(act).resolves.toBeUndefined();
      expect(loggerError).toHaveBeenCalledTimes(2);
    });

    it('原圖不存在時丟 UnrecoverableError，不產生縮圖', async () => {
      tempRead.mockResolvedValue(null);

      await expect(process()).rejects.toBeInstanceOf(UnrecoverableError);

      expect(render).not.toHaveBeenCalled();
    });

    it('解碼失敗時丟 UnrecoverableError，不寫檔', async () => {
      render.mockRejectedValue(new InvalidAvatarImageException('壞圖'));

      await expect(process()).rejects.toBeInstanceOf(UnrecoverableError);

      expect(mediaWrite).not.toHaveBeenCalled();
    });

    it('寫檔失敗時丟一般錯誤，交給 BullMQ 重試', async () => {
      mediaWrite.mockRejectedValue(new Error('ENOSPC'));

      const error: unknown = await process().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(UnrecoverableError);
      expect(completeVariants).not.toHaveBeenCalled();
    });
  });

  describe('completed 事件', () => {
    it('記錄 queue.job.completed，帶 queue、jobName、jobId、attempt', () => {
      // Act
      workerMock.completedListener!(createJob({ attemptsStarted: 2 }));

      // Assert
      expect(loggerLog).toHaveBeenCalledWith(
        expect.objectContaining({
          event: LOG_EVENTS.queueJobCompleted,
          queue: 'avatar',
          jobName: 'generate-avatar-variants',
          jobId: `avatar-variants-${uploadId}`,
          attempt: 2,
        }),
        'job 完成',
      );
    });
  });

  describe('failed 事件', () => {
    const fail = (job: Job<GenerateAvatarVariantsData>, error: Error) => {
      workerMock.failedListener!(job, error);
      return flushPromises();
    };

    it('每次失敗（包含之後還會重試的）都記錄 queue.job.failed，帶 err 與 job 欄位', async () => {
      // Arrange
      const error = new Error('ENOSPC');

      // Act
      await fail(createJob({ attemptsMade: 1, attemptsStarted: 1 }), error);

      // Assert
      expect(loggerError).toHaveBeenCalledWith(
        expect.objectContaining({
          event: LOG_EVENTS.queueJobFailed,
          err: error,
          queue: 'avatar',
          jobId: `avatar-variants-${uploadId}`,
          attempt: 1,
        }),
        'job 失敗',
      );
      // 還有重試次數，不做最終失敗處理
      expect(markVariantsFailed).not.toHaveBeenCalled();
    });

    it('最終失敗時另記一筆 warn 業務事件，不重複記錄失敗原因', async () => {
      // Act
      await fail(createJob({ attemptsMade: 3 }), new Error('ENOSPC'));

      // Assert
      expect(loggerWarn).toHaveBeenCalledWith(
        {
          event: LOG_EVENTS.avatarVariantsMarkedFailed,
          jobId: `avatar-variants-${uploadId}`,
          uploadId,
        },
        '頭像尺寸最終失敗，標記為 FAILED',
      );
    });

    it('拿不到 job 時不記錄也不處理', async () => {
      // Act
      workerMock.failedListener!(undefined, new Error('boom'));
      await flushPromises();

      // Assert
      expect(loggerError).not.toHaveBeenCalled();
      expect(markVariantsFailed).not.toHaveBeenCalled();
    });

    it('UnrecoverableError 第一次失敗就標記 FAILED 並刪除 temp 原圖', async () => {
      await fail(createJob({ attemptsMade: 1 }), new UnrecoverableError('x'));

      expect(markVariantsFailed).toHaveBeenCalledWith({ userId, uploadId });
      expect(tempDeleteDir).toHaveBeenCalledWith(dir);
    });

    it('一般錯誤還有重試次數時不處理', async () => {
      await fail(createJob({ attemptsMade: 2 }), new Error('ENOSPC'));

      expect(markVariantsFailed).not.toHaveBeenCalled();
      expect(tempDeleteDir).not.toHaveBeenCalled();
    });

    it('一般錯誤重試次數用完時標記 FAILED', async () => {
      await fail(createJob({ attemptsMade: 3 }), new Error('ENOSPC'));

      expect(markVariantsFailed).toHaveBeenCalledWith({ userId, uploadId });
      expect(tempDeleteDir).toHaveBeenCalledWith(dir);
    });

    it('標記 FAILED 失敗時仍會刪除 temp 原圖', async () => {
      markVariantsFailed.mockRejectedValue(new Error('DB down'));

      await fail(createJob(), new UnrecoverableError('x'));

      expect(tempDeleteDir).toHaveBeenCalledWith(dir);
    });
  });

  it('關閉時關閉 Worker', async () => {
    await service.onModuleDestroy();

    expect(workerMock.close).toHaveBeenCalledTimes(1);
  });
});
