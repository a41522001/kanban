import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { RedisModule } from '@/infrastructure/redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
