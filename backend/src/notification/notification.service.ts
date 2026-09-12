import { HttpStatus, Injectable } from '@nestjs/common';
import { NotificationRepository } from './notification.repository';
import type {
  CreateNotificationParams,
  FindByRecipientParams,
} from './notification.type';
import type { Prisma, Notification } from '@/generated/prisma/client';
import type {
  FindByRecipientResponse,
  PublicNotification,
} from '@kanban/contracts/notification';
import { DateTime } from 'luxon';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  /** Prisma notification to Public notification */
  private toPublicNotification(item: Notification): PublicNotification {
    return {
      id: item.id,
      type: item.type,
      workspaceId: item.workspaceId,
      resourceType: item.resourceType,
      resourceId: item.resourceId,
      readAt: item.readAt?.toISOString() ?? null,
      expiresAt: item.expiresAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    };
  }

  /** 取得所有通知 by userId */
  async findByRecipient(
    data: FindByRecipientParams,
  ): Promise<FindByRecipientResponse> {
    const result = await this.notificationRepository.findByRecipient(data);
    const publicNotification = result.items.map((item) =>
      this.toPublicNotification(item),
    );
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
    return this.notificationRepository.createNotification(data, tx);
  }

  /** 標記已讀 */
  async markReadIfUnread(id: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findByIdAndRecipient(
      id,
      userId,
    );
    if (notification === null) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        code: ApiCode.ResourceNotFound,
        message: '找不到該通知',
      });
    }
    await this.notificationRepository.markReadIfUnread(
      id,
      userId,
      DateTime.utc().toJSDate(),
    );
  }

  /** 標記全部訊息已讀 */
  async markAllReadByRecipient(userId: string): Promise<number> {
    const now = DateTime.utc();
    const result = await this.notificationRepository.markAllReadByRecipient(
      userId,
      now.toJSDate(),
    );
    return result.count;
  }
}
