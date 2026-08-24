import type { AxiosResponse } from 'axios';
import api from './http';
import type { LoginRequest, SignupRequest } from '@kanban/contracts/auth';
import type { PublicUser } from '@kanban/contracts/user';
import type { ApiResponse } from '@kanban/contracts/api';

export const getUserInfoApi = async (): Promise<ApiResponse<PublicUser>> => {
  const res = await api<ApiResponse<PublicUser>, LoginRequest>({
    url: '/user/userInfo',
    method: 'get',
  });
  return res.data;
};
