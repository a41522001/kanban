import axios from 'axios';
import type { HTTPMethod, ApiOption } from '@/types';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  withCredentials: true,
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
