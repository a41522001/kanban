import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import type { Prisma, Notification } from '@/generated/prisma/client';
import type {
  CreateNotificationParams,
  FindByRecipientParams,
} from './notification.type';

@Injectable()
export class NotificationRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /** 取得所有通知 by userId */
  async findByRecipient({
    recipientUserId,
    type,
    unreadOnly,
    cursor,
    limit,
  }: FindByRecipientParams): Promise<{
    items: Notification[];
    nextCursor: string | null;
  }> {
    // 1頁最少1筆通知 最多50筆通知
    const pageSize = Math.min(Math.max(limit ?? 20, 1), 50);
    const where: Prisma.NotificationWhereInput = {
      recipientUserId,
    };
    if (type) {
      where.type = type;
    }
    if (unreadOnly) {
      where.readAt = null;
    }

    const rows = await this.prismaService.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      take: pageSize + 1,
    });
    const hasNextPage = rows.length > pageSize;
    const items = hasNextPage ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasNextPage ? (items.at(-1)?.id ?? null) : null;
    return {
      items,
      nextCursor,
    };
  }

  /** 未讀數量 by userId*/
  async countUnreadByRecipient(userId: string): Promise<number> {
    return await this.prismaService.notification.count({
      where: {
        recipientUserId: userId,
        readAt: null,
      },
    });
  }

  /** 標記已讀 */
  async markReadIfUnread(id: string, userId: string, readAt: Date) {
    return await this.prismaService.notification.updateMany({
      where: {
        id,
        readAt: null,
        recipientUserId: userId,
      },
      data: {
        readAt,
      },
    });
  }
  /** 標記全部訊息已讀 */
  async markAllReadByRecipient(userId: string, readAt: Date) {
    return await this.prismaService.notification.updateMany({
      where: {
        recipientUserId: userId,
        readAt: null,
      },
      data: {
        readAt,
      },
    });
  }

  /** 取得單一郵件資訊 */
  async findByIdAndRecipient(id: string, userId: string) {
    return await this.prismaService.notification.findFirst({
      where: {
        id,
        recipientUserId: userId,
      },
    });
  }

  /** 創建通知 */
  async createNotification(
    data: CreateNotificationParams,
    tx?: Prisma.TransactionClient,
  ): Promise<Notification> {
    const db = tx ?? this.prismaService;

    return db.notification.create({
      data,
    });
  }
}
