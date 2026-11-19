import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisLockService } from './redisLock.service';
import { RateLimitService } from './rateLimit.service';

@Global()
@Module({
  controllers: [],
  providers: [RedisService, RedisLockService, RateLimitService],
  exports: [RedisService, RedisLockService, RateLimitService],
})
export class RedisModule {}
