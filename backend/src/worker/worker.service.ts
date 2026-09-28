import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { SendVerificationEmailData } from '@/types/queue';
import { Worker } from 'bullmq';
import { RedisService } from '@/redis/redis.service';
import { EmailService } from '@/email/email.service';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env';
import { redisKeys } from '@/redis/redis.keys';
@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService<Env>,
  ) {}
  private emailWorker!: Worker<SendVerificationEmailData>;
  onModuleInit() {
    this.emailWorker = new Worker<SendVerificationEmailData>(
      'email',
      async (job) => {
        console.log(job.id);
        console.log(job.name);
        console.log(job.data);
        if (job.name === 'send-verification-email') {
          await this.handleSendVerificationEmail(job.data);
        }
      },
      {
        connection: this.redisService.createBullMQConnection(),
      },
    );
  }

  async onModuleDestroy() {
    await this.emailWorker?.close();
    await this.redisService.destroyBullMqConnection();
  }

  async handleSendVerificationEmail(data: SendVerificationEmailData) {
    const { userId, email, token } = data;
    const redisClient = this.redisService.getClient();
    const redisKey = redisKeys.verifyEmail(token);
    const expireSeconds =
      this.configService.getOrThrow('VERIFY_MAIL_EXPIRE_MINUTE', {
        infer: true,
      }) * 60;
    const host = this.configService.getOrThrow('FRONTEND_URL', { infer: true });
    const url = `${host}/verifyEmail/${token}`;
    await redisClient
      .multi()
      .hSet(redisKey, {
        userId,
        email,
      })
      .expire(redisKey, expireSeconds)
      .exec();
    await this.emailService.sendVerifyEmail(email, url);
  }
}
