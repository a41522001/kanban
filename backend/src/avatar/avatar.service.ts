import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AvatarImageSet } from '@kanban/contracts/avatar';
import { MEDIA_STORAGE } from '@/storage/storage.tokens';
import type { StorageService } from '@/storage/storage.types';
import { AvatarRepository } from './avatar.repository';
import { ImageProcessingService } from './image/imageProcessing.service';
import { randomUUID } from 'node:crypto';
import { AvatarStorageUnavailableException } from '@/common/exceptions/avatar.exception';
import type { Avatar } from '@/generated/prisma/client';

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
      this.logger.error({ err: error, uploadId }, '寫入頭像檔案失敗');
      throw new AvatarStorageUnavailableException(STORAGE_UNAVAILABLE_MESSAGE);
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
      this.logger.error({ err: error, uploadId }, '儲存頭像資料失敗');
      // 清理失敗只記 log，不能蓋掉下面的 503。
      try {
        await this.mediaStorage.deleteDir(dirname);
      } catch (deleteError) {
        this.logger.error(
          { err: deleteError, uploadId },
          '清除本次上傳的頭像檔案失敗',
        );
      }
      throw new AvatarStorageUnavailableException(STORAGE_UNAVAILABLE_MESSAGE);
    }

    // 刪除舊頭像檔案
    if (oldAvatar !== null) {
      try {
        await this.mediaStorage.deleteDir(`avatars/${oldAvatar.uploadId}/`);
      } catch (error) {
        this.logger.error(
          { err: error, uploadId: oldAvatar.uploadId },
          '刪除舊頭像檔案失敗',
        );
      }
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
    const dirname = `avatars/${avatar.uploadId}/`;
    try {
      await this.mediaStorage.deleteDir(dirname);
    } catch (error) {
      this.logger.error(
        { err: error, uploadId: avatar.uploadId },
        '刪除頭像檔案失敗',
      );
    }
  }
}
