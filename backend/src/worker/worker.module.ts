import { type Env, envSchema } from '@/config/env';
import { RedisModule } from '@/redis/redis.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WorkerService } from './worker.service';
import { EmailModule } from '@/email/email.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { AvatarWorkerService } from './avatarWorker.service';
import { AvatarRepository } from '@/avatar/avatar.repository';
import { StorageModule } from '@/storage/storage.module';
import { ImageProcessingService } from '@/avatar/image/imageProcessing.service';
import { LoggerModule } from 'nestjs-pino';
import { loggerFactory } from '@/config/logger.config';
const envFilePath = process.env.E2E_ENV === 'true' ? '.env.e2e' : '.env';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      validate: (config) => envSchema.parse(config),
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env>) =>
        loggerFactory(configService, 'worker'),
    }),
    RedisModule,
    EmailModule,
    PrismaModule,
    StorageModule,
  ],
  controllers: [],
  providers: [
    WorkerService,
    AvatarWorkerService,
    AvatarRepository,
    ImageProcessingService,
  ],
  exports: [],
})
export class WorkerModule {}
