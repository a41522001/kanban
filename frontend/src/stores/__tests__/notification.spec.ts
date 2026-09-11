import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useNotificationStore } from '@/stores/notification';

vi.mock('@/services/notification', () => ({
  getNotificationsApi: vi.fn(),
  getNotificationUnreadCountApi: vi.fn(),
}));

describe('Notification Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('在通知選單重建時保留邀請回覆狀態', () => {
    const store = useNotificationStore();

    store.setInvitationResponseState('notification-1', 'accepted');

    expect(store.getInvitationResponseState('notification-1')).toBe('accepted');
  });

  it('登出重設時清除邀請回覆狀態', () => {
    const store = useNotificationStore();
    store.setInvitationResponseState('notification-1', 'declined');

    store.resetNotifications();

    expect(store.getInvitationResponseState('notification-1')).toBeUndefined();
  });
});
