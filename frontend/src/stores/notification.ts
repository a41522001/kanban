import { ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import type { PublicNotification } from '@kanban/contracts/notification';
import {
  getNotificationsApi,
  getNotificationUnreadCountApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
} from '@/services/notification';
import type { WorkspaceInvitationResponseState } from '@/types/workspaceInvitation';
import type { NotificationReadActionState } from '@/types/notification';

export const useNotificationStore = defineStore('notificationStore', () => {
  // Notification payload 是遞迴 JSON；列表只會整批替換，不需要 deep reactive proxy。
  const notifications = shallowRef<PublicNotification[]>([]);
  const unreadCount = ref(0);
  const isLoading = ref(false);
  const hasLoadError = ref(false);
  const hasLoadedUnreadCount = ref(false);
  const invitationResponseStates = ref<Record<string, WorkspaceInvitationResponseState>>({});
  const notificationReadStates = ref<Record<string, NotificationReadActionState>>({});
  const markAllReadState = ref<NotificationReadActionState>('default');
  let pendingNotificationsRequest: Promise<void> | null = null;
  let pendingUnreadCountRequest: Promise<void> | null = null;
  let pendingMarkAllReadRequest: Promise<void> | null = null;
  const pendingMarkReadRequests = new Map<string, Promise<void>>();
  let markAllReadResetTimer: ReturnType<typeof setTimeout> | null = null;

  const loadNotifications = (force = false) => {
    if (pendingNotificationsRequest) {
      return pendingNotificationsRequest;
    }

    if (!force && notifications.value.length > 0 && !hasLoadError.value) {
      return Promise.resolve();
    }

    isLoading.value = true;
    hasLoadError.value = false;

    pendingNotificationsRequest = getNotificationsApi()
      .then((response) => {
        notifications.value = response.data?.items ?? [];
      })
      .catch(() => {
        hasLoadError.value = true;
      })
      .finally(() => {
        isLoading.value = false;
        pendingNotificationsRequest = null;
      });

    return pendingNotificationsRequest;
  };

  const loadUnreadCount = (force = false) => {
    if (pendingUnreadCountRequest) {
      return pendingUnreadCountRequest;
    }

    if (!force && hasLoadedUnreadCount.value) {
      return Promise.resolve();
    }

    pendingUnreadCountRequest = getNotificationUnreadCountApi()
      .then((response) => {
        unreadCount.value = Math.max(response.data?.count ?? 0, 0);
        hasLoadedUnreadCount.value = true;
      })
      .catch(() => {
        // 未讀數失敗不阻斷通知列表；開啟選單或 Socket 事件時可再次同步。
      })
      .finally(() => {
        pendingUnreadCountRequest = null;
      });

    return pendingUnreadCountRequest;
  };

  const refreshNotifications = async () => {
    await Promise.all([loadNotifications(true), loadUnreadCount(true)]);
  };

  const markNotificationRead = (notificationId: string) => {
    const existingRequest = pendingMarkReadRequests.get(notificationId);
    if (existingRequest) {
      return existingRequest;
    }

    const notification = notifications.value.find((item) => item.id === notificationId);
    if (!notification || notification.readAt !== null) {
      return Promise.resolve();
    }

    notificationReadStates.value = {
      ...notificationReadStates.value,
      [notificationId]: 'processing',
    };

    const request = markNotificationReadApi({ notificationId })
      .then(() => {
        notifications.value = notifications.value.map((item) =>
          item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item,
        );
        unreadCount.value = Math.max(unreadCount.value - 1, 0);
        notificationReadStates.value = {
          ...notificationReadStates.value,
          [notificationId]: 'complete',
        };
      })
      .catch((error: unknown) => {
        notificationReadStates.value = {
          ...notificationReadStates.value,
          [notificationId]: 'error',
        };
        throw error;
      })
      .finally(() => {
        pendingMarkReadRequests.delete(notificationId);
      });

    pendingMarkReadRequests.set(notificationId, request);
    return request;
  };

  const markAllNotificationsRead = () => {
    if (pendingMarkAllReadRequest) {
      return pendingMarkAllReadRequest;
    }

    if (unreadCount.value === 0 && markAllReadState.value === 'default') {
      return Promise.resolve();
    }

    if (markAllReadResetTimer) {
      clearTimeout(markAllReadResetTimer);
      markAllReadResetTimer = null;
    }

    markAllReadState.value = 'processing';
    pendingMarkAllReadRequest = markAllNotificationsReadApi()
      .then((response) => {
        const readAt = new Date().toISOString();
        notifications.value = notifications.value.map((item) =>
          item.readAt === null ? { ...item, readAt } : item,
        );
        unreadCount.value = Math.max(unreadCount.value - (response.data ?? 0), 0);
        markAllReadState.value = 'complete';
        markAllReadResetTimer = setTimeout(() => {
          markAllReadState.value = 'default';
          markAllReadResetTimer = null;
        }, 1600);
      })
      .catch((error: unknown) => {
        markAllReadState.value = 'error';
        throw error;
      })
      .finally(() => {
        pendingMarkAllReadRequest = null;
      });

    return pendingMarkAllReadRequest;
  };

  const getInvitationResponseState = (notificationId: string) => {
    return invitationResponseStates.value[notificationId];
  };

  const setInvitationResponseState = (
    notificationId: string,
    state: WorkspaceInvitationResponseState,
  ) => {
    invitationResponseStates.value = {
      ...invitationResponseStates.value,
      [notificationId]: state,
    };
  };

  const clearInvitationResponseState = (notificationId: string) => {
    const remainingStates = { ...invitationResponseStates.value };
    delete remainingStates[notificationId];
    invitationResponseStates.value = remainingStates;
  };

  const resetNotifications = () => {
    notifications.value = [];
    unreadCount.value = 0;
    isLoading.value = false;
    hasLoadError.value = false;
    hasLoadedUnreadCount.value = false;
    invitationResponseStates.value = {};
    notificationReadStates.value = {};
    markAllReadState.value = 'default';
    pendingNotificationsRequest = null;
    pendingUnreadCountRequest = null;
    pendingMarkAllReadRequest = null;
    pendingMarkReadRequests.clear();
    if (markAllReadResetTimer) {
      clearTimeout(markAllReadResetTimer);
      markAllReadResetTimer = null;
    }
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    hasLoadError,
    notificationReadStates,
    markAllReadState,
    loadNotifications,
    loadUnreadCount,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getInvitationResponseState,
    setInvitationResponseState,
    clearInvitationResponseState,
    resetNotifications,
  };
});
