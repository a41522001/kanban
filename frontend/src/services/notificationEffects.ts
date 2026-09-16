import type {
  NotificationResourceType,
  NotificationType,
  PublicNotification,
} from '@kanban/contracts/notification';
import { useWorkspaceStore } from '@/stores/workspace';

type ResourceSyncHandler = (resourceId: string | null) => Promise<void>;
type NotificationEffectHandler = (notification: PublicNotification) => Promise<void>;

const skipResourceSync: ResourceSyncHandler = () => Promise.resolve();

/**
 * 集中管理 domain resource 的重新同步策略。
 *
 * Project／Board／Card Store 與 read API 完成後，在對應 handler 接上即可，
 * 不需要讓 Notification Store 或 UI 元件知道各 domain 的載入細節。
 */
const resourceSyncHandlers: Record<NotificationResourceType, ResourceSyncHandler> = {
  WORKSPACE_INVITATION: skipResourceSync,
  WORKSPACE: async () => {
    await useWorkspaceStore().refreshWorkspaces();
  },
  PROJECT: skipResourceSync,
  BOARD: skipResourceSync,
  CARD: skipResourceSync,
};

export const syncNotificationResource = async (
  resourceType: NotificationResourceType,
  resourceId: string | null,
): Promise<void> => {
  await resourceSyncHandlers[resourceType](resourceId);
};

const skipNotificationEffect: NotificationEffectHandler = () => Promise.resolve();

/**
 * notification.type 決定事件是否需要更新 domain read model；
 * resourceType + resourceId 只負責定位要同步的 domain resource。
 */
const notificationEffectHandlers: Record<NotificationType, NotificationEffectHandler> = {
  WORKSPACE_INVITED: skipNotificationEffect,
  WORKSPACE_MEMBER_JOINED: async (notification) => {
    await syncNotificationResource(notification.resourceType, notification.resourceId);
  },
  PROJECT_MEMBER_ADDED: async (notification) => {
    await syncNotificationResource(notification.resourceType, notification.resourceId);
  },
  CARD_ASSIGNED: async (notification) => {
    await syncNotificationResource(notification.resourceType, notification.resourceId);
  },
  CARD_MENTIONED: async (notification) => {
    await syncNotificationResource(notification.resourceType, notification.resourceId);
  },
  CARD_REMINDER: skipNotificationEffect,
};

export const handleNotificationEffect = async (notification: PublicNotification): Promise<void> => {
  await notificationEffectHandlers[notification.type](notification);
};
