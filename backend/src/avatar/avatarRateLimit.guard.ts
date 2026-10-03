import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { RedisService } from '@/redis/redis.service';

/**
 * Avatar 上傳頻率限制；必須在 Multer 讀取 body 之前執行，所以做成 Guard。
 * 需排在 SessionGuard 之後，才能取得 req.userId。
 */
@Injectable()
export class AvatarRateLimitGuard implements CanActivate {
  constructor(private readonly redisService: RedisService) {}

  // TODO：fixed window。
  //  INCR redisKeys.rateLimitAvatarUpload(userId)；結果為 1 時 EXPIRE AVATAR_UPLOAD_WINDOW_SECONDS。
  //  超過 AVATAR_UPLOAD_LIMIT 丟 AppException(429, AvatarRateLimited, data: { retryAfterSeconds: TTL })。
  canActivate(context: ExecutionContext): Promise<boolean> {
    throw new NotImplementedException();
  }
}
