import {
  Inject,
  Injectable,
  Logger,
  NotImplementedException,
} from '@nestjs/common';
import type { AvatarImageSet } from '@kanban/contracts/avatar';
import { MEDIA_STORAGE } from '@/storage/storage.tokens';
import type { StorageService } from '@/storage/storage.types';
import { AvatarRepository } from './avatar.repository';
import { ImageProcessingService } from './image/imageProcessing.service';
import { randomUUID } from 'node:crypto';
import { AvatarStorageUnavailableException } from '@/common/exceptions/avatar.exception';

const STORAGE_UNAVAILABLE_MESSAGE = '頭像暫時無法儲存，請稍後再試';

@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);

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

    try {
      await this.mediaStorage.write(storageKey, mediumWebp, 'image/webp');
    } catch (error) {
      this.logger.error(
        { err: error, uploadId },
        'Failed to write avatar file',
      );
      throw new AvatarStorageUnavailableException(STORAGE_UNAVAILABLE_MESSAGE);
    }

    try {
      await this.avatarRepository.upsertCurrent({
        userId,
        uploadId,
        mediumUrl,
      });
    } catch (error) {
      this.logger.error({ err: error, uploadId }, 'Failed to upsert avatar');
      // 清理失敗只記 log，不能蓋掉下面的 503。
      try {
        await this.mediaStorage.deleteDir(dirname);
      } catch (deleteError) {
        this.logger.error(
          { err: deleteError, uploadId },
          'Failed to delete avatar files',
        );
      }
      throw new AvatarStorageUnavailableException(STORAGE_UNAVAILABLE_MESSAGE);
    }

    return {
      smallUrl: null,
      mediumUrl,
      largeUrl: null,
    };
  }

  /** 移除頭像（冪等） */
  remove(_userId: string): Promise<void> {
    throw new NotImplementedException();
  }
}
