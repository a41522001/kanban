import type { ApiResponse } from '@kanban/contracts/api';
import type { FindByRecipientResponse } from '@kanban/contracts/notification';
import api from './http';

export const getNotificationsApi = async (): Promise<ApiResponse<FindByRecipientResponse>> => {
  const response = await api<ApiResponse<FindByRecipientResponse>>({
    url: '/notifications',
    method: 'get',
  });

  return response.data;
};

export const getNotificationUnreadCountApi = async (): Promise<ApiResponse<{ count: number }>> => {
  const response = await api<ApiResponse<{ count: number }>>({
    url: '/notifications/unreadCount',
    method: 'get',
  });

  return response.data;
};
