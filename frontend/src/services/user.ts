import api from './http';
import type { PublicUser } from '@kanban/contracts/user';
import type { ApiResponse } from '@kanban/contracts/api';

export const getUserInfoApi = async (): Promise<ApiResponse<PublicUser>> => {
  const res = await api<ApiResponse<PublicUser>>({
    url: '/user/userInfo',
    method: 'get',
  });
  return res.data;
};
