import type {
  NotificationResourceType,
  NotificationResourceTypeByNotification,
  NotificationType,
} from '@kanban/contracts/notification';
export interface FindByRecipientParams {
  recipientUserId: string;
  type?: NotificationType;
  unreadOnly?: boolean;
  cursor?: string;
  limit?: number;
}

interface CreateNotificationBase<
  TResourceType extends NotificationResourceType,
> {
  recipientUserId: string;
  actorUserId: string | null;
  workspaceId: string | null;
  resourceType: TResourceType;
  resourceId: string | null;
  dedupeKey: string | null;
  expiresAt?: Date | null;
}

export type CreateNotificationParams = {
  [TType in NotificationType]: CreateNotificationBase<
    NotificationResourceTypeByNotification[TType]
  > & {
    type: TType;
  };
}[NotificationType];
