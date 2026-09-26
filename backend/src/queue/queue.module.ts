import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { RedisModule } from '@/redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [QueueService],
})
export class QueueModule {}
