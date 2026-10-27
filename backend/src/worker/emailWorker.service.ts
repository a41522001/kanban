import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { SendVerificationEmailData } from '@/common/types/queue';
import { Worker } from 'bullmq';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { EmailService } from '@/infrastructure/email/email.service';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env';
import { redisKeys } from '@/infrastructure/redis/redis.keys';
import { jobLogFields } from './jobLogFields';
import { LOG_EVENTS } from '@/common/constants/logEvents';
@Injectable()
export class EmailWorkerService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService<Env>,
  ) {}
  private readonly logger = new Logger(EmailWorkerService.name);
  private emailWorker!: Worker<SendVerificationEmailData>;
  onModuleInit() {
    this.emailWorker = new Worker<SendVerificationEmailData>(
      'email',
      async (job) => {
        if (job.name === 'send-verification-email') {
          await this.handleSendVerificationEmail(job.data);
        }
      },
      {
        connection: this.redisService.createBullMQConnection(),
      },
    );

    this.emailWorker.on('completed', (job) => {
      this.logger.log(
        { event: LOG_EVENTS.queueJobCompleted, ...jobLogFields(job) },
        'job 完成',
      );
    });

    this.emailWorker.on('failed', (job, error) => {
      if (job === undefined) {
        return;
      }
      this.logger.error(
        { event: LOG_EVENTS.queueJobFailed, err: error, ...jobLogFields(job) },
        'job 失敗',
      );
    });
  }

  async onModuleDestroy() {
    await this.emailWorker?.close();
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
