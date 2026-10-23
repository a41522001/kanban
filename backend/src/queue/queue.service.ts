import { type IRedisClient, Queue, QueueEvents } from 'bullmq';
import { RedisService } from '@/redis/redis.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type {
  SendVerificationEmailData,
  GenerateAvatarVariantsData,
} from '@/types/queue';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly redisService: RedisService) {}

  private redisClient!: IRedisClient;
  private emailQueue!: Queue<SendVerificationEmailData>;
  private emailQueueEvent!: QueueEvents;
  private avatarQueue!: Queue<GenerateAvatarVariantsData>;
  async addVerificationEmailQueue(data: SendVerificationEmailData) {
    return this.emailQueue.add('send-verification-email', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  }
  async addAvatarQueue(data: GenerateAvatarVariantsData) {
    return this.avatarQueue.add('generate-avatar-variants', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      jobId: `avatar-variants-${data.uploadId}`,
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 604800 },
    });
  }
  onModuleInit() {
    this.redisClient = this.redisService.createBullMQConnection();
    //#region  email queue
    this.emailQueue = new Queue<SendVerificationEmailData>('email', {
      connection: this.redisClient,
    });
    this.emailQueueEvent = new QueueEvents('email', {
      connection: this.redisClient,
    });
    this.emailQueueEvent.on('completed', ({ jobId }) => {
      void this.emailQueue
        .getJob(jobId)
        .then((job) => console.log(job))
        .catch((error: unknown) => console.error('讀取已完成工作失敗', error));
    });
    //#endregion

    //#region avatar queue
    this.avatarQueue = new Queue<GenerateAvatarVariantsData>('avatar', {
      connection: this.redisClient,
    });
    //#endregion
  }
  async onModuleDestroy(): Promise<void> {
    // QueueEvents 也持有 Redis 連線，關閉事件監聽後再結束 Queue。
    await this.emailQueueEvent?.close();
    await this.emailQueue?.close();
    await this.avatarQueue?.close();
  }
}
