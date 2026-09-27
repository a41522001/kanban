import api from './http';
import type { LoginRequest, SignupRequest, SignupResult } from '@kanban/contracts/auth';
import type { ApiResponse } from '@kanban/contracts/api';
export const signupApi = async (data: SignupRequest): Promise<ApiResponse<SignupResult>> => {
  const res = await api<ApiResponse<SignupResult>, SignupRequest>({
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

export const logoutApi = async (): Promise<ApiResponse<null>> => {
  const res = await api<ApiResponse<null>>({
    url: '/auth/logout',
    method: 'post',
  });
  return res.data;
};
