import { type IRedisClient, Queue } from 'bullmq';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type {
  SendVerificationEmailData,
  GenerateAvatarVariantsData,
} from '@/common/types/queue';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly redisService: RedisService) {}

  private redisClient!: IRedisClient;
  private emailQueue!: Queue<SendVerificationEmailData>;
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
    this.emailQueue = new Queue<SendVerificationEmailData>('email', {
      connection: this.redisClient,
    });
    this.avatarQueue = new Queue<GenerateAvatarVariantsData>('avatar', {
      connection: this.redisClient,
    });
  }
  async onModuleDestroy(): Promise<void> {
    await this.emailQueue?.close();
    await this.avatarQueue?.close();
  }
}
