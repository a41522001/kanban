# API Contract 與錯誤處理計畫

## 1. 目標

統一 HTTP success、validation、business error 與 unexpected error 的 transport contract，讓 frontend 不需要依 HTTP endpoint 猜測錯誤格式。

## 2. Response Envelope

~~~ts
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
~~~

成功 response：

~~~json
{
  "code": 1,
  "data": {},
  "message": "請求成功",
  "time": "2026-08-20T00:00:00.000Z",
  "error": null
}
~~~

Validation response：

~~~json
{
  "code": 0,
  "data": null,
  "message": "請求參數錯誤",
  "time": "2026-08-20T00:00:00.000Z",
  "error": {
    "email": {
      "value": "invalid-email",
      "messages": ["Email 格式不正確"]
    },
    "password": {
      "value": null,
      "messages": ["密碼至少需要 8 個字元"]
    }
  }
}
~~~

## 3. HTTP Status 與 Application Code

| 情境 | HTTP status | Application code |
|---|---:|---:|
| 成功 | 200 / 201 | 1 |
| Validation failed | 400 | 0，之後改成專用 code |
| Invalid credentials | 401 | 0，之後改成專用 code |
| Forbidden | 403 | 專用 code |
| Resource not found | 404 | 專用 code |
| Conflict | 409 | 專用 code |
| Rate limited | 429 | 專用 code |
| Unexpected error | 500 | 5000 |

Decision pending：建立集中式 ErrorCode enum，避免 controller 直接散落 magic number。

## 4. Exception Ownership

- ValidationPipe 將 ValidationError 轉成 FieldErrors，再建立 AppException。
- Controller 可拋出 transport 或 business exception。
- Service 回傳 domain result 或拋出無法恢復的錯誤，不組 HTTP response。
- HttpExceptionFilter 是唯一組裝 error envelope 的地方。
- 未預期錯誤不可將 stack、SQL、Redis key 或內部錯誤訊息回傳給 client。

## 5. Validation 規則

- whitelist：啟用。
- forbidNonWhitelisted：啟用。
- transform：啟用。
- stopAtFirstError：目前啟用，每個欄位回傳第一個可操作錯誤。
- Email 可 trim 與 lowercase。
- Password 不可 trim。
- Password、Token、Cookie 等敏感欄位的 error value 固定為 null。
- 非敏感字串最多回傳 200 字元。
- Object、Array 等複雜錯誤值固定為 null。

目前 formatter 僅需支援 flat DTO。出現 ValidateNested 或 array DTO 時，再加入 children path，例如 cards.0.title。

## 6. Filter 規格

- AppException：使用 status、code、message、errors 組 response。
- 一般 HttpException：轉成統一 envelope，不直接輸出 Nest 原始 response。
- Unknown exception：固定 code 5000 與安全訊息。
- 所有分支都必須 return，避免重複寫 response。
- Error logging 規格依 logging-plan.md。

## 7. Swagger

- 建立可重用的 success/error schema decorator，避免 controller 內重複手寫 envelope。
- Validation error schema 必須反映 FieldError 的 value 與 messages。
- Auth endpoints 應文件化 400、401、409。

## 8. 測試

- formatValidationErrors unit test。
- ValidationPipe unit test。
- HttpExceptionFilter unit test。
- Signup/Login invalid payload integration test。
- 多餘欄位拒絕測試。
- Password 不出現在 response 與 log 的測試。
- Unknown error response 不含 stack 的測試。

## 9. 驗收條件

- 所有 endpoint 的 error response 都符合 ApiResponse。
- Frontend 只需實作一個 error parser。
- Validation field error 可直接對應表單欄位。
- Password/Cookie/Token 不出現在 response。
- Swagger 與 contracts 一致。

