import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import type { AvatarImageSet } from '@kanban/contracts/avatar';
import { MEDIA_STORAGE, TEMP_STORAGE } from '@/storage/storage.tokens';
import type { StorageService } from '@/storage/storage.types';
import { AvatarRepository } from './avatar.repository';
import { ImageProcessingService } from './image/imageProcessing.service';

@Injectable()
export class AvatarService {
  constructor(
    private readonly avatarRepository: AvatarRepository,
    private readonly imageProcessingService: ImageProcessingService,
    @Inject(MEDIA_STORAGE) private readonly mediaStorage: StorageService,
    @Inject(TEMP_STORAGE) private readonly tempStorage: StorageService,
  ) {}

  // TODO（規格書 §4.3）：
  //  1. imageProcessingService.validate
  //  2. render('md')
  //  3. uploadId = randomUUID()
  //  4. 寫入 media `avatars/<uploadId>/md.webp` 與 temp `avatars/<uploadId>/original`
  //  5. avatarRepository.upsertCurrent
  //  6. （第 7 步才加）入列背景 job；失敗只記 log
  //  7. 回傳 AvatarImageSet（smallUrl／largeUrl 為 null）
  /** 上傳並同步產生 md 尺寸 */
  upload(userId: string, file: Buffer): Promise<AvatarImageSet> {
    throw new NotImplementedException();
  }

  /** 移除頭像（冪等） */
  remove(userId: string): Promise<void> {
    throw new NotImplementedException();
  }
}
