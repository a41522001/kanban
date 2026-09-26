import { type IRedisClient, Queue } from 'bullmq';
import { RedisService } from '@/redis/redis.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly redisService: RedisService) {}

  private redisClient!: IRedisClient;
  private SEND_EMAIL_QUEUE_NAME = 'sendEmail';
  private queue!: Queue;
  async sendEmailQueue() {
    await this.queue.add();
  }

  onModuleInit() {
    this.redisClient = this.redisService.createBullMQConnection();
    this.queue = new Queue(this.SEND_EMAIL_QUEUE_NAME, {
      connection: this.redisClient,
    });
  }
  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }
}
