import { Injectable, NotImplementedException } from '@nestjs/common';
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

  /** 取得使用者目前的頭像 */
  findByUserId(userId: string): Promise<Avatar | null> {
    throw new NotImplementedException();
  }

  // TODO: upsert；新上傳要換 uploadId、mediumUrl，並把 smallUrl／largeUrl 設 null、
  //       variantStatus=PENDING、variantAttempts=0。
  /** 設定使用者目前的頭像為新上傳 */
  upsertCurrent(data: UpsertCurrentAvatarData): Promise<Avatar> {
    throw new NotImplementedException();
  }

  // TODO: deleteMany 以保持冪等；不刪檔，交給孤兒清理。
  /** 移除使用者頭像 */
  deleteByUserId(userId: string): Promise<void> {
    throw new NotImplementedException();
  }
}
