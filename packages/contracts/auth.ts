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
