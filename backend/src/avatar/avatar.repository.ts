import { Injectable } from '@nestjs/common';
import type { Avatar } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

/** 同步上傳完成後寫入的資料。 */
export interface UpsertCurrentAvatarData {
  userId: string;
  uploadId: string;
  mediumUrl: string;
}

@Injectable()
export class AvatarRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /** 設定使用者目前的頭像為新上傳 */
  async upsertCurrent(data: UpsertCurrentAvatarData): Promise<Avatar> {
    const avatar = await this.prismaService.avatar.upsert({
      where: {
        userId: data.userId,
      },
      create: {
        userId: data.userId,
        uploadId: data.uploadId,
        mediumUrl: data.mediumUrl,
      },
      update: {
        uploadId: data.uploadId,
        mediumUrl: data.mediumUrl,
        smallUrl: null,
        largeUrl: null,
        variantStatus: 'PENDING',
        variantAttempts: 0,
      },
    });
    return avatar;
  }
}
