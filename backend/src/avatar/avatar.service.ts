import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import type { AvatarImageSet } from '@kanban/contracts/avatar';
import { MEDIA_STORAGE } from '@/storage/storage.tokens';
import type { StorageService } from '@/storage/storage.types';
import { AvatarRepository } from './avatar.repository';
import { ImageProcessingService } from './image/imageProcessing.service';
import { randomUUID } from 'node:crypto';

@Injectable()
export class AvatarService {
  constructor(
    private readonly avatarRepository: AvatarRepository,
    private readonly imageProcessingService: ImageProcessingService,
    @Inject(MEDIA_STORAGE) private readonly mediaStorage: StorageService,
    // @Inject(TEMP_STORAGE) private readonly tempStorage: StorageService,
  ) {}

  /** 上傳並同步產生 md 尺寸 */
  async upload(userId: string, file: Buffer): Promise<AvatarImageSet> {
    await this.imageProcessingService.validate(file);
    const mediumWebp = await this.imageProcessingService.render(file, 'md');
    const uploadId = randomUUID();
    const storageKey = `avatars/${uploadId}/md.webp`;
    const dirname = `avatars/${uploadId}/`;
    const mediumUrl = this.mediaStorage.getPublicUrl(storageKey);
    await this.mediaStorage.write(storageKey, mediumWebp, 'image/webp');
    try {
      await this.avatarRepository.upsertCurrent({
        userId,
        uploadId,
        mediumUrl,
      });
      return {
        smallUrl: null,
        mediumUrl,
        largeUrl: null,
      };
    } catch (error) {
      await this.mediaStorage.deleteDir(dirname);
      throw error;
    }
  }

  /** 移除頭像（冪等） */
  remove(_userId: string): Promise<void> {
    throw new NotImplementedException();
  }
}
