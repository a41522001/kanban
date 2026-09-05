import { Injectable } from '@nestjs/common';
import { NotificationRepository } from './notification.repository';
import type {
  CreateNotificationParams,
  FindByRecipientParams,
} from './notification.type';
import type { Prisma } from '@/generated/prisma/client';
@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  /** 取得所有通知 by userId */
  async findByRecipient(data: FindByRecipientParams) {
    const result = await this.notificationRepository.findByRecipient(data);
    const publicNotification = result.items.map((item) => {
      const {
        type,
        id,
        workspaceId,
        resourceType,
        resourceId,
        payload,
        readAt,
        expiresAt,
        createdAt,
      } = item;
      return {
        type,
        id,
        workspaceId,
        resourceType,
        resourceId,
        payload,
        readAt: readAt?.toISOString() ?? null,
        expiresAt: expiresAt?.toISOString() ?? null,
        createdAt: createdAt?.toISOString(),
      };
    });
    return {
      items: publicNotification,
      nextCursor: result.nextCursor,
    };
  }

  /** 未讀數量 by userId*/
  async countUnreadByRecipient(userId: string): Promise<number> {
    const result = this.notificationRepository.countUnreadByRecipient(userId);
    return result;
  }

  /** 創建通知 */
  async createNotification(
    data: CreateNotificationParams,
    tx?: Prisma.TransactionClient,
  ) {
    const result = this.notificationRepository.createNotification(data, tx);
    return result;
  }
}
