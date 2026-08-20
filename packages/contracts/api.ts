export interface FieldError<TValue = unknown> {
  value: TValue | null;
  messages: string[];
}

export type FieldErrors = Record<string, FieldError>;
export interface ApiResponse<TData> {
  code: number;
  data: TData | null;
  message: string;
  time: string;
  error: FieldErrors | null;
}
export interface ApiResult<T> {
  data?: T;
  message?: string;
  code?: number;
}
