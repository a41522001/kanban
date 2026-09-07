import { Injectable } from '@nestjs/common';
import { NotificationRepository } from './notification.repository';
import type {
  CreateNotificationParams,
  FindByRecipientParams,
} from './notification.type';
import type { Prisma, Notification } from '@/generated/prisma/client';
import type {
  FindByRecipientResponse,
  JsonObject,
  PublicNotification,
  WorkspaceInvitedPayload,
} from '@kanban/contracts/notification';

/** 轉換一般Payload */
const parseJsonObject = (payload: unknown): JsonObject => {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new Error('Notification payload 必須是 JSON object');
  }

  return payload as JsonObject;
};

/** 轉換WorkspaceInvited Payload */
const parseWorkspaceInvitedPayload = (
  payload: unknown,
): WorkspaceInvitedPayload => {
  const jsonObject = parseJsonObject(payload);

  if (
    typeof jsonObject.workspaceName !== 'string' ||
    typeof jsonObject.inviterDisplayName !== 'string' ||
    jsonObject.role !== 'MEMBER'
  ) {
    throw new Error('WORKSPACE_INVITED notification payload 格式錯誤');
  }

  return {
    workspaceName: jsonObject.workspaceName,
    inviterDisplayName: jsonObject.inviterDisplayName,
    role: jsonObject.role,
  };
};

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  /** Prisma notification to Public notification */
  private toPublicNotification(item: Notification): PublicNotification {
    const base = {
      id: item.id,
      type: item.type,
      workspaceId: item.workspaceId,
      resourceType: item.resourceType,
      resourceId: item.resourceId,
      readAt: item.readAt?.toISOString() ?? null,
      expiresAt: item.expiresAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    };
    switch (item.type) {
      case 'WORKSPACE_INVITED':
        return {
          ...base,
          type: 'WORKSPACE_INVITED',
          payload: parseWorkspaceInvitedPayload(item.payload),
        };
      case 'WORKSPACE_MEMBER_JOINED':
        return {
          ...base,
          type: 'WORKSPACE_MEMBER_JOINED',
          payload: parseJsonObject(item.payload),
        };
      case 'PROJECT_MEMBER_ADDED':
        return {
          ...base,
          type: 'PROJECT_MEMBER_ADDED',
          payload: parseJsonObject(item.payload),
        };
      case 'CARD_ASSIGNED':
        return {
          ...base,
          type: 'CARD_ASSIGNED',
          payload: parseJsonObject(item.payload),
        };
      case 'CARD_MENTIONED':
        return {
          ...base,
          type: 'CARD_MENTIONED',
          payload: parseJsonObject(item.payload),
        };
      case 'CARD_REMINDER':
        return {
          ...base,
          type: 'CARD_REMINDER',
          payload: parseJsonObject(item.payload),
        };
    }
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
    switch (data.type) {
      case 'WORKSPACE_INVITED':
        parseWorkspaceInvitedPayload(data.payload);
        break;

      default:
        parseJsonObject(data.payload);
        break;
    }

    return this.notificationRepository.createNotification(data, tx);
  }
}
