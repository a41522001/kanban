import type { AxiosResponse } from 'axios';
import api from './http';
import type { LoginRequest, SignupRequest } from '@kanban/contracts/auth';
import type { ApiResponse } from '@kanban/contracts/api';
export const signupApi = async (data: SignupRequest): Promise<ApiResponse<null>> => {
  const res = await api<ApiResponse<null>, SignupRequest>({
    url: '/auth/signup',
    method: 'post',
    data,
  });
  return res.data;
};
export const loginApi = async (data: LoginRequest): Promise<ApiResponse<null>> => {
  const res = await api<ApiResponse<null>, LoginRequest>({
    url: '/auth/login',
    method: 'post',
    data,
  });
  return res.data;
};
export const getUserInfoApi = async (): Promise<ApiResponse<null>> => {
  const res = await api<ApiResponse<null>, LoginRequest>({
    url: '/auth/userInfo',
    method: 'get',
  });
  return res.data;
};
