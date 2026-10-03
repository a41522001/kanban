import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  NotImplementedException,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { ApiResult } from '@kanban/contracts/api';
import {
  AVATAR_MAX_FILE_BYTES,
  type AvatarImageSet,
} from '@kanban/contracts/avatar';
import { SessionGuard } from '@/session/session.guard';
import { AvatarService } from './avatar.service';
import { AvatarRateLimitGuard } from './avatarRateLimit.guard';

@ApiTags('Avatar')
@ApiCookieAuth()
@Controller('user/me/avatar')
@UseGuards(SessionGuard)
export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

  // 未指定 storage 時 Multer 使用記憶體，file.buffer 即為上傳內容。
  // TODO：
  //  - declared MIME 不在 AVATAR_ALLOWED_MIME_TYPES → 415 / AvatarUnsupportedType（可用 fileFilter）
  //  - 缺檔案 → 400 / ValidationError
  //  - Multer 超過大小（Nest 轉成 PayloadTooLargeException）→ 413 / AvatarFileTooLarge
  //  - InvalidAvatarImageError → 400 / AvatarInvalidImage
  /** 上傳頭像，回傳同步產生的 md 尺寸 */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @UseGuards(AvatarRateLimitGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: AVATAR_MAX_FILE_BYTES, files: 1, fields: 0 },
    }),
  )
  upload(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<ApiResult<AvatarImageSet>> {
    throw new NotImplementedException();
  }

  /** 移除頭像（冪等） */
  @Delete()
  @HttpCode(HttpStatus.OK)
  remove(@Req() req: Request): Promise<ApiResult<null>> {
    throw new NotImplementedException();
  }
}
