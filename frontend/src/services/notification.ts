import type { ApiResponse } from '@kanban/contracts/api';
import type { FindByRecipientResponse, MarkReadRequest } from '@kanban/contracts/notification';
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

export const markNotificationReadApi = async (
  data: MarkReadRequest,
): Promise<ApiResponse<null>> => {
  const response = await api<ApiResponse<null>, MarkReadRequest>({
    url: '/notifications/read',
    method: 'patch',
    data,
  });

  return response.data;
};

export const markAllNotificationsReadApi = async (): Promise<ApiResponse<number>> => {
  const response = await api<ApiResponse<number>>({
    url: '/notifications/readAll',
    method: 'patch',
  });

  return response.data;
};
