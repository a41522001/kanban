import type {
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
export interface CreateNotificationParams {
  recipientUserId: string;
  actorUserId: string | null;
  workspaceId: string | null;
  type: NotificationType;
  resourceType: NotificationResourceType;
  resourceId: string | null;
  payload: Prisma.InputJsonValue;
  dedupeKey: string | null;
  expiresAt?: Date | null;
}
