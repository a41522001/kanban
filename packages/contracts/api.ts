/** 單一欄位的驗證錯誤資訊。 */
export interface FieldError<TValue = unknown> {
  value: TValue | null;
  messages: string[];
}
/** API 對外使用的結果代碼。 */
export enum ApiCode {
  /** 請求成功 */
  Success = 1,
  /** DTO 或 request payload 驗證失敗 */
  ValidationError = 1000,
  /** 帳號或密碼錯誤 */
  InvalidCredentials = 2001,
  /** Email 已被註冊 */
  EmailAlreadyRegistered = 2002,
  /** 尚未登入、Session 不存在或已失效 */
  Unauthenticated = 2003,
  /** 找不到自己可存取的資源 */
  ResourceNotFound = 3001,
  /** 未被 AppException 明確分類的預期 HTTP 錯誤 */
  RequestError = 4000,
  /** 未預期的伺服器錯誤 */
  InternalError = 5000,
}
/** 以欄位名稱索引的驗證錯誤集合。 */
export type FieldErrors = Record<string, FieldError>;

/** 所有 API 回應共用的外層結構。 */
export interface ApiResponse<TData> {
  code: ApiCode;
  data: TData | null;
  message: string;
  time: string;
  error: FieldErrors | null;
}
/** 較簡化的 API 結果型別，適合非標準回應或前端處理結果。 */
export interface ApiResult<T> {
  data?: T;
  message?: string;
  code?: ApiCode;
}
