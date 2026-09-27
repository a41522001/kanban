import { type IRedisClient, Queue, QueueEvents } from 'bullmq';
import { RedisService } from '@/redis/redis.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { SendVerificationEmailData } from '@/types/queue';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly redisService: RedisService) {}

  private redisClient!: IRedisClient;
  private emailQueue!: Queue<SendVerificationEmailData>;
  private emailQueueEvent!: QueueEvents;
  async addVerificationEmailQueue(data: SendVerificationEmailData) {
    return this.emailQueue.add('send-verification-email', data);
  }

  onModuleInit() {
    this.redisClient = this.redisService.createBullMQConnection();
    this.emailQueue = new Queue<SendVerificationEmailData>('email', {
      connection: this.redisClient,
    });
    this.emailQueueEvent = new QueueEvents('email', {
      connection: this.redisClient,
    });
    this.emailQueueEvent.on('completed', async ({ jobId }) => {
      console.log(123);
      const job = await this.emailQueue.getJob(jobId);
      console.log(job);
    });
  }
  async onModuleDestroy(): Promise<void> {
    await this.emailQueue?.close();
    await this.redisService.destroyBullMqConnection();
  }
}
