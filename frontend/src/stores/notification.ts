import { ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import type { PublicNotification } from '@kanban/contracts/notification';
import { getNotificationsApi, getNotificationUnreadCountApi } from '@/services/notification';

export const useNotificationStore = defineStore('notificationStore', () => {
  // Notification payload 是遞迴 JSON；列表只會整批替換，不需要 deep reactive proxy。
  const notifications = shallowRef<PublicNotification[]>([]);
  const unreadCount = ref(0);
  const isLoading = ref(false);
  const hasLoadError = ref(false);
  const hasLoadedUnreadCount = ref(false);
  let pendingNotificationsRequest: Promise<void> | null = null;
  let pendingUnreadCountRequest: Promise<void> | null = null;

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

  const resetNotifications = () => {
    notifications.value = [];
    unreadCount.value = 0;
    isLoading.value = false;
    hasLoadError.value = false;
    hasLoadedUnreadCount.value = false;
    pendingNotificationsRequest = null;
    pendingUnreadCountRequest = null;
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    hasLoadError,
    loadNotifications,
    loadUnreadCount,
    refreshNotifications,
    resetNotifications,
  };
});
