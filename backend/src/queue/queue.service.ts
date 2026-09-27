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
    this.emailQueueEvent.on('completed', ({ jobId }) => {
      console.log(123);
      void this.emailQueue
        .getJob(jobId)
        .then((job) => console.log(job))
        .catch((error: unknown) => console.error('讀取已完成工作失敗', error));
    });
  }
  async onModuleDestroy(): Promise<void> {
    // QueueEvents 也持有 Redis 連線，關閉事件監聽後再結束 Queue。
    await this.emailQueueEvent?.close();
    await this.emailQueue?.close();
    await this.redisService.destroyBullMqConnection();
  }
}
