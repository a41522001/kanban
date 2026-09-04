# API Contract 與錯誤處理規格

## 1. 目標

統一 HTTP success、validation、business error 與 unexpected error 的 transport contract，讓 frontend 不需要依 HTTP endpoint 猜測錯誤格式。

## 2. Response Envelope

~~~ts
export interface FieldError<TValue = unknown> {
  value: TValue | null;
  messages: string[];
}

export enum ApiCode {
  Success = 1,
  ValidationError = 1000,
  InvalidCredentials = 2001,
  EmailAlreadyRegistered = 2002,
  RequestError = 4000,
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
  "code": 1000,
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

## 3. Application Code 規範

`ApiCode` 定義於 `packages/contracts/api.ts`，是 HTTP API 的唯一 code source of truth。backend 與 frontend 都必須引用它，禁止直接寫 magic number，也不可用 `message` 作為流程判斷。

| Code | 名稱 | HTTP status | 使用情境 | 前端處理 |
|---:|---|---|---|---|
| `1` | `Success` | 2xx | 請求成功 | 正常處理 `data`。 |
| `1000` | `ValidationError` | 400 | DTO／request payload 驗證失敗 | 顯示 `error` 內的欄位訊息；表單頁不顯示通用 Alert。 |
| `2001` | `InvalidCredentials` | 401 | Email 或密碼錯誤 | 顯示安全的登入失敗訊息。 |
| `2002` | `EmailAlreadyRegistered` | 409 | 註冊 Email 已存在 | 顯示安全的註冊失敗訊息。 |
| `4000` | `RequestError` | 預期的 4xx | 未以 `AppException` 明確分類的一般 `HttpException` | 顯示通用「請求失敗」或依頁面情境處理。 |
| `5000` | `InternalError` | 500 | 未預期的 server error | 顯示本地化通用錯誤；不可顯示原始例外內容。 |

新增 code 時：

1. 先在 `ApiCode` 新增名稱與數值，再由 backend／frontend 引用。
2. 以穩定的業務情境命名，例如 `WorkspaceNotFound`，不要用 endpoint 或 message 命名。
3. 同步補上本表、Filter／Controller 測試，以及前端需要的 UI 行為。
4. 已發布的 code 不改變語意，也不重新指派給其他錯誤。

HTTP status 表示 transport 狀態；`code` 表示可供 client 穩定判斷的 application 情境。兩者都要保留。

## 4. Exception Ownership

- ValidationPipe 將 ValidationError 轉成 FieldErrors，再建立 AppException。
- Controller 可拋出 transport 或 business exception。
- Service 回傳 domain result 或拋出無法恢復的錯誤，不組 HTTP response。
- HttpExceptionFilter 是唯一組裝 error envelope 的地方。
- 未預期錯誤不可將 stack、SQL、Redis key 或內部錯誤訊息回傳給 client。
- `ApiCode` 是 runtime contract；`packages/contracts` 會同時輸出 ESM 給 frontend 與 CJS 給 backend，不能將它改回 type-only export。

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
- 一般 HttpException：回 `RequestError` 與安全的「請求失敗」，不直接輸出 Nest 原始 response 或 `exception.message`。
- Unknown exception：固定 `InternalError` 與「發生非預期錯誤」。
- 所有分支都必須 return，避免重複寫 response。
- 正常 validation 與其他預期 4xx 由 HTTP access log 記錄，不寫 error log；未知 exception 才以 Pino error log 記錄詳細內容。

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
- ValidationError 不顯示「請求參數錯誤」這類通用 Alert。
- Password/Cookie/Token 不出現在 response。
- Swagger 與 contracts 一致。
