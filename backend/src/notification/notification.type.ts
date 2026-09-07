import type {
  NotificationPayloadMap,
  NotificationResourceType,
  NotificationType,
} from '@kanban/contracts/notification';
import type { Prisma } from '@/generated/prisma/client';
export interface FindByRecipientParams {
  recipientUserId: string;
  type?: NotificationType;
  unreadOnly?: boolean;
  cursor?: string;
  limit?: number;
}

interface CreateNotificationBase {
  recipientUserId: string;
  actorUserId: string | null;
  workspaceId: string | null;
  resourceType: NotificationResourceType;
  resourceId: string | null;
  dedupeKey: string | null;
  expiresAt?: Date | null;
}

export type CreateNotificationParams = {
  [TType in NotificationType]: CreateNotificationBase & {
    type: TType;
    payload: NotificationPayloadMap[TType] & Prisma.InputJsonObject;
  };
}[NotificationType];
