export type FieldErrors = Record<string, string[]>;
export interface ApiResponse<T> {
  code: number;
  data: T | null;
  message: string;
  time: string;
  error: FieldErrors | null;
}
export interface ApiResult<T> {
  data?: T;
  message?: string;
  code?: number;
}
