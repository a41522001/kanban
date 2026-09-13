import axios from 'axios';
import { ApiCode, type ApiResponse } from '@kanban/contracts/api';
import type { HTTPMethod, ApiOption } from '@/types';

export const sessionExpiredEvent = 'kanban:session-expired';

const isApiResponse = (value: unknown): value is ApiResponse<unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const response = value as Partial<ApiResponse<unknown>>;
  return (
    typeof response.code === 'number' &&
    typeof response.message === 'string' &&
    typeof response.time === 'string'
  );
};

export const getApiErrorResponse = (error: unknown): ApiResponse<unknown> | undefined => {
  if (!axios.isAxiosError(error) || !isApiResponse(error.response?.data)) {
    return undefined;
  }

  return error.response.data;
};

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  withCredentials: true,
});

apiClient.interceptors.response.use(undefined, (error: unknown) => {
  if (
    getApiErrorResponse(error)?.code === ApiCode.Unauthenticated &&
    typeof window !== 'undefined'
  ) {
    window.dispatchEvent(new Event(sessionExpiredEvent));
  }

  return Promise.reject(error);
});

const api = async <TResponse, TRequest = undefined>({
  url,
  data,
  method,
  headers,
}: ApiOption<TRequest>) => {
  const res = await apiClient.request<TResponse>({
    url,
    method: method.toUpperCase(),
    data,
    headers,
  });
  return res;
};

export default api;
