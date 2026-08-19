import type { AxiosHeaders, HeadersDefaults, RawAxiosRequestHeaders } from 'axios';
export type HTTPMethod =
  | 'get'
  | 'GET'
  | 'Get'
  | 'post'
  | 'POST'
  | 'Post'
  | 'delete'
  | 'DELETE'
  | 'Delete'
  | 'put'
  | 'PUT'
  | 'Put'
  | 'patch'
  | 'PATCH'
  | 'Patch';
export interface ApiOption<T> {
  url: string;
  data?: T;
  method: HTTPMethod;
  headers?: RawAxiosRequestHeaders;
}
