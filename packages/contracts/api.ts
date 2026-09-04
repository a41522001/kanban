export interface FieldError<TValue = unknown> {
  value: TValue | null;
  messages: string[];
}
export enum ApiCode {
  /** 請求成功 */
  Success = 1,

  /** DTO 或 request payload 驗證失敗 */
  ValidationError = 1000,

  /** 帳號或密碼錯誤 */
  InvalidCredentials = 2001,

  /** Email 已被註冊 */
  EmailAlreadyRegistered = 2002,

  /** 未被 AppException 明確分類的預期 HTTP 錯誤 */
  RequestError = 4000,

  /** 未預期的伺服器錯誤 */
  InternalError = 5000,
}
export type FieldErrors = Record<string, FieldError>;
export interface ApiResponse<TData> {
  code: ApiCode;
  data: TData | null;
  message: string;
  time: string;
  error: FieldErrors | null;
}
export interface ApiResult<T> {
  data?: T;
  message?: string;
  code?: ApiCode;
}
