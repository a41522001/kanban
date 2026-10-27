import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { Job } from 'bullmq';
import { LOG_EVENTS } from '@/common/constants/logEvents';
import type { SendVerificationEmailData } from '@/common/types/queue';
import { EmailService } from '@/infrastructure/email/email.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { EmailWorkerService } from './emailWorker.service';

type Processor = (job: Job<SendVerificationEmailData>) => Promise<void>;
type FailedListener = (
  job: Job<SendVerificationEmailData> | undefined,
  error: Error,
) => void;
type CompletedListener = (job: Job<SendVerificationEmailData>) => void;

// 攔截 `new Worker(...)`，不需要 Redis 就能驅動處理函式與事件監聽。
const workerMock = {
  name: '',
  processor: undefined as Processor | undefined,
  failedListener: undefined as FailedListener | undefined,
  completedListener: undefined as CompletedListener | undefined,
  close: jest.fn().mockResolvedValue(undefined),
};
jest.mock('bullmq', () => ({
  ...jest.requireActual<typeof import('bullmq')>('bullmq'),
  Worker: jest.fn((name: string, processor: Processor) => {
    workerMock.name = name;
    workerMock.processor = processor;
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
  }),
}));

const token = 'secret-verify-token';
const createJob = (
  overrides: Partial<Job<SendVerificationEmailData>> = {},
): Job<SendVerificationEmailData> =>
  ({
    id: '42',
    queueName: 'email',
    name: 'send-verification-email',
    attemptsStarted: 1,
    data: { userId: 'user-1', email: 'user@example.com', token },
    ...overrides,
  }) as Job<SendVerificationEmailData>;

describe('EmailWorkerService', () => {
  let sendVerifyEmail: jest.Mock;
  let multi: { hSet: jest.Mock; expire: jest.Mock; exec: jest.Mock };
  let loggerLog: jest.SpyInstance;
  let loggerError: jest.SpyInstance;
  let service: EmailWorkerService;

  beforeEach(async () => {
    loggerLog = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    sendVerifyEmail = jest.fn().mockResolvedValue(undefined);
    multi = {
      hSet: jest.fn(),
      expire: jest.fn(),
      exec: jest.fn().mockResolvedValue([]),
    };
    multi.hSet.mockReturnValue(multi);
    multi.expire.mockReturnValue(multi);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailWorkerService,
        {
          provide: RedisService,
          useValue: {
            getClient: () => ({ multi: () => multi }),
            createBullMQConnection: () => ({}),
          },
        },
        { provide: EmailService, useValue: { sendVerifyEmail } },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) =>
              key === 'VERIFY_MAIL_EXPIRE_MINUTE' ? 30 : 'http://app.test',
          },
        },
      ],
    }).compile();

    service = module.get(EmailWorkerService);
    service.onModuleInit();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    workerMock.close.mockClear();
  });

  it('監聽 email queue', () => {
    expect(workerMock.name).toBe('email');
  });

  describe('處理 job', () => {
    it('寄驗證信：token 寫入 Redis 並寄出含驗證連結的信，過程中不記錄 job 資料', async () => {
      // Act
      await workerMock.processor!(createJob());

      // Assert
      expect(multi.hSet).toHaveBeenCalledWith(`verify:email:${token}`, {
        userId: 'user-1',
        email: 'user@example.com',
      });
      expect(multi.expire).toHaveBeenCalledWith(`verify:email:${token}`, 1800);
      expect(sendVerifyEmail).toHaveBeenCalledWith(
        'user@example.com',
        `http://app.test/verifyEmail/${token}`,
      );
      const logged = JSON.stringify([
        loggerLog.mock.calls,
        loggerError.mock.calls,
      ]);
      expect(logged).not.toContain(token);
      expect(logged).not.toContain('user@example.com');
    });

    it('其他 job name 不處理', async () => {
      // Act
      await workerMock.processor!(createJob({ name: 'unknown-job' }));

      // Assert
      expect(sendVerifyEmail).not.toHaveBeenCalled();
    });
  });

  describe('事件 log', () => {
    it('completed 記錄 queue.job.completed，帶 queue、jobId，不含 job 資料', () => {
      // Act
      workerMock.completedListener!(createJob());

      // Assert
      expect(loggerLog).toHaveBeenCalledWith(
        expect.objectContaining({
          event: LOG_EVENTS.queueJobCompleted,
          queue: 'email',
          jobName: 'send-verification-email',
          jobId: '42',
          attempt: 1,
        }),
        'job 完成',
      );
      expect(JSON.stringify(loggerLog.mock.calls)).not.toContain(token);
    });

    it('failed 記錄 queue.job.failed，帶 err 與 queue、jobId', () => {
      // Arrange
      const error = new Error('SMTP timeout');

      // Act
      workerMock.failedListener!(createJob({ attemptsStarted: 2 }), error);

      // Assert
      expect(loggerError).toHaveBeenCalledWith(
        expect.objectContaining({
          event: LOG_EVENTS.queueJobFailed,
          err: error,
          queue: 'email',
          jobId: '42',
          attempt: 2,
        }),
        'job 失敗',
      );
    });

    it('拿不到 job 時不記錄', () => {
      // Act
      workerMock.failedListener!(undefined, new Error('boom'));

      // Assert
      expect(loggerError).not.toHaveBeenCalled();
    });
  });

  it('關閉時關閉 Worker', async () => {
    // Act
    await service.onModuleDestroy();

    // Assert
    expect(workerMock.close).toHaveBeenCalledTimes(1);
  });
});
