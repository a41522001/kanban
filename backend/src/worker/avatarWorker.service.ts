import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
  Inject,
} from '@nestjs/common';
import type { GenerateAvatarVariantsData } from '@/types/queue';
import { type Job, Worker, UnrecoverableError } from 'bullmq';
import { RedisService } from '@/redis/redis.service';
import { AvatarRepository } from '@/avatar/avatar.repository';
import { AVATAR_WORKER_CONCURRENCY } from '@/avatar/avatar.constants';
import { ImageProcessingService } from '@/avatar/image/imageProcessing.service';
import { MEDIA_STORAGE, TEMP_STORAGE } from '@/storage/storage.tokens';
import type { StorageService } from '@/storage/storage.types';
@Injectable()
export class AvatarWorkerService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly redisService: RedisService,
    private readonly avatarRepository: AvatarRepository,
    private readonly imageProcessingService: ImageProcessingService,
    @Inject(MEDIA_STORAGE) private readonly mediaStorage: StorageService,
    @Inject(TEMP_STORAGE) private readonly tempStorage: StorageService,
  ) {}
  private readonly logger = new Logger(AvatarWorkerService.name);
  private avatarWorker!: Worker<GenerateAvatarVariantsData>;
  onModuleInit() {
    this.avatarWorker = new Worker<GenerateAvatarVariantsData>(
      'avatar',
      async (job) => {
        const { userId, uploadId } = job.data;
        const avatar = await this.avatarRepository.findByUserId(userId);
        if (avatar === null || avatar.uploadId !== uploadId) {
          this.logger.log(
            { jobId: job.id, uploadId },
            '頭像已被刪除或取代，略過',
          );
          return;
        }
        this.logger.log({ jobId: job.id, uploadId }, '開始產生 sm／lg');

        const originalKey = `avatars/${uploadId}/original`;
        const original = await this.tempStorage.read(originalKey);
        if (original === null) {
          throw new UnrecoverableError('原圖不存在');
        }

        let smallWebp: Buffer;
        let largeWebp: Buffer;
        try {
          smallWebp = await this.imageProcessingService.render(original, 'sm');
          largeWebp = await this.imageProcessingService.render(original, 'lg');
        } catch (error) {
          this.logger.error(
            { err: error, jobId: job.id, uploadId },
            '原圖解碼失敗',
          );
          throw new UnrecoverableError('原圖解碼失敗');
        }

        await this.mediaStorage.write(
          `avatars/${uploadId}/sm.webp`,
          smallWebp,
          'image/webp',
        );
        await this.mediaStorage.write(
          `avatars/${uploadId}/lg.webp`,
          largeWebp,
          'image/webp',
        );
        this.logger.log({ jobId: job.id, uploadId }, 'sm／lg 已寫入');

        const count = await this.avatarRepository.completeVariants({
          userId,
          uploadId,
          smallUrl: this.mediaStorage.getPublicUrl(
            `avatars/${uploadId}/sm.webp`,
          ),
          largeUrl: this.mediaStorage.getPublicUrl(
            `avatars/${uploadId}/lg.webp`,
          ),
        });
        this.logger.log({ jobId: job.id, uploadId, count }, '寫回 DB');

        // DB 已寫好，清理失敗只記 log，不能丟錯，否則 BullMQ 會重試整個 job。
        const dirname = `avatars/${uploadId}/`;
        if (count === 0) {
          // 處理途中被取代或刪除：寫入 sm／lg 時重新建立的資料夾已無人引用。
          try {
            await this.mediaStorage.deleteDir(dirname);
          } catch (error) {
            this.logger.error(
              { err: error, uploadId, storage: 'media' },
              '刪除已被取代的頭像檔案失敗',
            );
          }
        }
        try {
          await this.tempStorage.deleteDir(dirname);
        } catch (error) {
          this.logger.error(
            { err: error, uploadId, storage: 'temp' },
            '刪除頭像原圖失敗',
          );
        }
      },
      {
        connection: this.redisService.createBullMQConnection(),
        concurrency: AVATAR_WORKER_CONCURRENCY,
      },
    );

    // 每次失敗都會觸發（包含之後還會重試的那幾次），只在最終失敗時處理。
    this.avatarWorker.on('failed', (job, error) => {
      if (job === undefined || !this.isFinalFailure(job, error)) {
        return;
      }
      void this.handleFinalFailure(job);
    });
  }

  async onModuleDestroy() {
    await this.avatarWorker?.close();
  }

  /** UnrecoverableError 不會重試；其他錯誤要等重試次數用完才算最終失敗。 */
  private isFinalFailure(
    job: Job<GenerateAvatarVariantsData>,
    error: Error,
  ): boolean {
    const isUnrecoverable =
      error instanceof UnrecoverableError ||
      error.name === 'UnrecoverableError';
    return isUnrecoverable || job.attemptsMade >= (job.opts.attempts ?? 1);
  }

  /** 標記 FAILED（前端繼續用 md）並刪除 temp 原圖；失敗只記 log。 */
  private async handleFinalFailure(
    job: Job<GenerateAvatarVariantsData>,
  ): Promise<void> {
    const { userId, uploadId } = job.data;
    this.logger.error(
      { jobId: job.id, uploadId, reason: job.failedReason },
      '頭像尺寸產生最終失敗',
    );
    try {
      await this.avatarRepository.markVariantsFailed({ userId, uploadId });
    } catch (error) {
      this.logger.error({ err: error, uploadId }, '標記頭像 FAILED 失敗');
    }
    try {
      await this.tempStorage.deleteDir(`avatars/${uploadId}/`);
    } catch (error) {
      this.logger.error(
        { err: error, uploadId, storage: 'temp' },
        '刪除頭像原圖失敗',
      );
    }
  }
}
