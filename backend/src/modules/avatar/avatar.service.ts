import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AvatarImageSet } from '@kanban/contracts/avatar';
import {
  MEDIA_STORAGE,
  TEMP_STORAGE,
} from '@/infrastructure/storage/storage.tokens';
import type { StorageService } from '@/infrastructure/storage/storage.types';
import { AvatarRepository } from './avatar.repository';
import { ImageProcessingService } from './image/imageProcessing.service';
import { randomUUID } from 'node:crypto';
import { AvatarStorageUnavailableException } from '@/common/exceptions/avatar.exception';
import type { Avatar } from '@/generated/prisma/client';
import { QueueService } from '@/infrastructure/queue/queue.service';

const STORAGE_UNAVAILABLE_MESSAGE = '頭像暫時無法儲存，請稍後再試';

@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);

  constructor(
    private readonly avatarRepository: AvatarRepository,
    private readonly imageProcessingService: ImageProcessingService,
    private readonly queueService: QueueService,
    @Inject(MEDIA_STORAGE) private readonly mediaStorage: StorageService,
    @Inject(TEMP_STORAGE) private readonly tempStorage: StorageService,
  ) {}

  /** 上傳並同步產生 md 尺寸 */
  async upload(userId: string, file: Buffer): Promise<AvatarImageSet> {
    const metadata = await this.imageProcessingService.validate(file);
    const mediumWebp = await this.imageProcessingService.render(file, 'md');
    const uploadId = randomUUID();
    const storageKey = `avatars/${uploadId}/md.webp`;
    const originalKey = `avatars/${uploadId}/original`;
    const mediumUrl = this.mediaStorage.getPublicUrl(storageKey);
    try {
      await this.mediaStorage.write(storageKey, mediumWebp, 'image/webp');
      await this.tempStorage.write(
        originalKey,
        file,
        `image/${metadata.format}`,
      );
    } catch (error) {
      await this.deleteUploadDirs(uploadId, '清除寫入失敗的頭像檔案失敗');
      throw new AvatarStorageUnavailableException(STORAGE_UNAVAILABLE_MESSAGE, {
        cause: error,
        event: 'avatar.upload.write_failed',
      });
    }

    let oldAvatar: Avatar | null;
    try {
      oldAvatar = await this.avatarRepository.findByUserId(userId);
      await this.avatarRepository.upsertCurrent({
        userId,
        uploadId,
        mediumUrl,
      });
    } catch (error) {
      // 清理失敗只記 log，不能蓋掉下面的 503。
      try {
        await this.deleteUploadDirs(uploadId, '清除本次上傳的頭像檔案失敗');
      } catch (deleteError) {
        this.logger.error(
          { err: deleteError, uploadId },
          '清除本次上傳的頭像檔案失敗',
        );
      }
      throw new AvatarStorageUnavailableException(STORAGE_UNAVAILABLE_MESSAGE, {
        cause: error,
        event: 'avatar.upload.save_failed',
      });
    }

    try {
      await this.queueService.addAvatarQueue({ userId, uploadId });
    } catch (error) {
      this.logger.error({ err: error, uploadId }, '頭像尺寸工作入列失敗');
    }

    // 刪除舊頭像檔案
    if (oldAvatar !== null) {
      await this.deleteUploadDirs(oldAvatar.uploadId, '刪除舊頭像檔案失敗');
    }

    return {
      smallUrl: null,
      mediumUrl,
      largeUrl: null,
    };
  }

  /** 移除頭像（冪等） */
  async remove(userId: string): Promise<void> {
    const avatar = await this.avatarRepository.findByUserId(userId);
    if (avatar === null) {
      return;
    }
    const count = await this.avatarRepository.deleteByUserId(userId);
    if (count === 0) {
      return;
    }

    await this.deleteUploadDirs(avatar.uploadId, '刪除頭像檔案失敗');
  }

  /** 刪除某次上傳在 media 與 temp 的資料夾；失敗只記 log，不丟錯。 */
  private async deleteUploadDirs(
    uploadId: string,
    reason: string,
  ): Promise<void> {
    const dirname = `avatars/${uploadId}/`;
    // 兩邊分開 try，media 刪除失敗時仍要繼續刪 temp。
    try {
      await this.mediaStorage.deleteDir(dirname);
    } catch (error) {
      this.logger.error({ err: error, uploadId, storage: 'media' }, reason);
    }
    try {
      await this.tempStorage.deleteDir(dirname);
    } catch (error) {
      this.logger.error({ err: error, uploadId, storage: 'temp' }, reason);
    }
  }
}
