/** 使用者註冊時送出的資料。 */
export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

/** 使用者登入時送出的資料。 */
export interface LoginRequest {
  email: string;
  password: string;
}

/** 重寄驗證信的請求。 */
export interface ResendVerificationEmailRequest {
  email: string;
}

/** 前端重寄按鈕的倒數；單位為秒。 */
export interface VerificationEmailCooldown {
  retryAfterSeconds: number;
}

/** 201 代表帳號已建立；emailQueued 只表示入列，不代表 SMTP 已寄出。 */
export interface SignupResult extends VerificationEmailCooldown {
  accountCreated: true;
  emailQueued: boolean;
}

/** 受理重寄申請，不揭露帳號是否存在或已驗證。 */
export type ResendVerificationEmailResult = VerificationEmailCooldown;

/** 密碼正確但尚未驗證時，提供前端驗證信頁所需的 Email。 */
export interface EmailVerificationRequiredData {
  email: string;
}
