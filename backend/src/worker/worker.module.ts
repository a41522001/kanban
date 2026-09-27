import { envSchema } from '@/config/env';
import { RedisModule } from '@/redis/redis.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkerService } from './worker.service';
import { EmailModule } from '@/email/email.module';
const envFilePath = process.env.E2E_ENV === 'true' ? '.env.e2e' : '.env';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      validate: (config) => envSchema.parse(config),
    }),
    RedisModule,
    EmailModule,
  ],
  controllers: [],
  providers: [WorkerService],
  exports: [],
})
export class WorkerModule {}
