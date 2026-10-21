import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { RedisService } from '@/redis/redis.service';
import type { Request } from 'express';
import { redisKeys } from '@/redis/redis.keys';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import {
  AVATAR_UPLOAD_LIMIT,
  AVATAR_UPLOAD_WINDOW_SECONDS,
} from './avatar.constants';

/**
 * Avatar 上傳頻率限制；必須在 Multer 讀取 body 之前執行，所以做成 Guard。
 * 需排在 SessionGuard 之後，才能取得 req.userId。
 */
@Injectable()
export class AvatarRateLimitGuard implements CanActivate {
  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const userId = request.userId!;
    const key = redisKeys.rateLimitAvatarUpload(userId);
    const client = this.redisService.getClient();
    const count = await client.incr(key);
    await client.expire(key, AVATAR_UPLOAD_WINDOW_SECONDS, 'NX');
    if (count > AVATAR_UPLOAD_LIMIT) {
      throw new AppException({
        code: ApiCode.AvatarRateLimited,
        message: '上傳太頻繁，請稍後再試',
        status: HttpStatus.TOO_MANY_REQUESTS,
        data: { retryAfterSeconds: Math.max(0, await client.ttl(key)) },
      });
    }
    return true;
  }
}
