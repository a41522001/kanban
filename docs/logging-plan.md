# Flowboard Backend Logging Plan

## 1. 目標

為 Flowboard backend 建立一致、可搜尋、可關聯且不洩漏敏感資料的 structured logging。

完成後應具備：

- Development 使用 `pino-pretty`，production 輸出單行 JSON。
- 每個 HTTP request 都有穩定的 `requestId`。
- HTTP、Auth、Session、Redis、Prisma 與 Socket.IO 使用一致的事件名稱與欄位。
- 預期錯誤與未預期錯誤使用不同 level 與內容。
- Password、Cookie、Session ID、Token、Password Hash 不會出現在 log。
- Error 只由適合的邊界記錄一次，避免重複 log。
- Logging 行為有自動化測試與明確驗收方式。

## 2. 目前狀態

已完成：

- 使用 `nestjs-pino` 與 Pino。
- Development 使用 `pino-pretty`。
- Production 保持 JSON output。
- 已 redact：
  - `req.headers.cookie`
  - `req.headers.authorization`
  - `req.body.password`
  - `res.headers['set-cookie']`
- NestJS 已透過 `app.useLogger()` 使用 Pino。

待改善：

- Redis 與 Socket.IO 仍使用 `console.*`；`HttpExceptionFilter` 尚未寫入 logger。
- 尚未定義 request ID 策略。
- 尚未定義共用 log schema 與 event naming。
- `HttpExceptionFilter` 已由 `APP_FILTER` 註冊，可使用 Nest DI；測試內手動建立 Filter 不代表 production registration。
- 缺少 Auth、Session、Redis、Prisma、Socket.IO application events。
- 缺少 redaction、request ID 與 error logging 測試。
- 尚未規劃 production log retention、aggregation 與 alert。

## 3. Logging 原則

1. Production log 只輸出到 stdout，不由應用程式管理 log file。
2. 每筆 log 使用 structured object，不使用字串拼接物件。
3. 每筆 log 應有穩定的 `event`。
4. Request scope 的 log 應包含 `requestId`。
5. 不預設記錄完整 request body、response body 或 Socket payload。
6. 不記錄 password、Cookie、raw session ID、session hash、token 或 password hash。
7. Repository 與 Service 不應 catch、log 後再原樣 rethrow，避免重複記錄。
8. 預期 4xx 不記錄 stack；未預期 5xx 必須在 server log 保留 stack。
9. Client response 永遠不可包含 stack 或內部 dependency 資訊。
10. Metrics、audit log 與 application log 應視為不同用途，不用 log 取代所有 metrics。

## 4. 共用 Log Schema

建議欄位：

```ts
type CommonLogFields = {
  event: string;
  requestId?: string;
  context?: string;
  userId?: string;
  socketId?: string;
  boardId?: string;
  commandId?: string;
  statusCode?: number;
  durationMs?: number;
  reason?: string;
};
```

Production JSON 範例：

```json
{
  "level": 30,
  "time": 1787184000000,
  "service": "flowboard-backend",
  "environment": "production",
  "event": "auth.login_succeeded",
  "requestId": "8e72f717-19f0-4e60-bf82-32d75fbba0f0",
  "userId": "8be862a1-91ee-457f-b6ba-c64cb57d692d",
  "context": "AuthService",
  "msg": "Login succeeded"
}
```

Pino 呼叫方式：

```ts
logger.info(
  {
    event: 'auth.login_succeeded',
    userId,
  },
  'Login succeeded',
);
```

Error 必須使用 Pino 的 `err` 欄位，才能正確 serialize stack：

```ts
logger.error(
  {
    event: 'http.unexpected_error',
    err: exception,
  },
  'Unexpected HTTP error',
);
```

## 5. Event Naming

格式：

```text
<domain>.<action>_<outcome>
```

範例：

- `auth.login_succeeded`
- `auth.login_failed`
- `session.created`
- `redis.client_error`
- `socket.room_denied`
- `socket.command_succeeded`

Event name 應保持穩定，不將 user ID、board ID 或其他動態值放進 event 字串。

## 6. Log Level 規則

| Level | 使用時機 |
|---|---|
| `debug` | Repository 結果、Session lookup、Socket event 細節 |
| `info` | 啟動完成、HTTP 成功、登入成功、Session 建立、Socket connect |
| `warn` | 登入失敗、401、403、409、429、Redis reconnect、權限拒絕 |
| `error` | 500、Redis/Prisma 操作失敗、未預期 exception |
| `fatal` | 設定錯誤、dependency 無法連線、應用程式無法啟動 |

HTTP 建議：

- 2xx、3xx：`info`
- Validation 400、一般 404：`info`
- 401、403、409、429：`warn`
- 5xx：`error`

## 7. 第一階段：Logging 基礎

### 7.1 環境變數

在 backend env schema 加入：

```env
LOG_LEVEL=debug
SERVICE_NAME=flowboard-backend
APP_VERSION=local
```

建議預設：

- Development：`debug`
- Test：`silent` 或 `warn`
- Production：`info`

所有 log 加入：

```ts
{
  service: SERVICE_NAME,
  environment: NODE_ENV,
  version: APP_VERSION,
}
```

### 7.2 Request ID

在 `pinoHttp.genReqId` 建立 request ID：

1. Request 有合法 `X-Request-ID` 時沿用。
2. 沒有或格式不合法時使用 `randomUUID()`。
3. Response 回傳相同 `X-Request-ID`。
4. Nginx 未來需傳遞相同 header。

合法 request ID 至少要限制：

- 最大長度。
- 僅允許英數字、`-`、`_`。
- 不可直接信任任意 header 內容並寫入 log。

### 7.3 HTTP Serializers

Request log 僅保留：

- method
- url/path
- requestId
- remote address
- user agent（視需要）

Response log 僅保留：

- statusCode
- durationMs

不預設加入 request body、response body 或完整 headers。

### 7.4 Redaction

至少涵蓋：

```text
req.headers.cookie
req.headers.authorization
req.body.password
req.body.confirmPassword
req.body.currentPassword
req.body.newPassword
req.body.token
req.body.accessToken
req.body.refreshToken
req.query.token
res.headers.set-cookie
sessionId
passwordHash
```

使用固定 censor：

```text
[REDACTED]
```

即使設定 redaction，application code 仍不可主動把 secret 放入 log object。

## 8. 第二階段：Exception Logging

### 8.1 讓 Exception Filter 使用 DI

目前使用：

```ts
app.useGlobalFilters(new HttpExceptionFilter());
```

建議改為：

1. `HttpExceptionFilter` 加上 `@Injectable()`。
2. 注入 `PinoLogger`。
3. 透過 `APP_FILTER` provider 註冊。
4. 移除手動 `new HttpExceptionFilter()`。
5. 移除 Filter 裡所有 `console.*`。

### 8.2 AppException / 預期 4xx

記錄：

```ts
{
  event: 'http.expected_error',
  statusCode,
  code: exception.code,
  validationFields: Object.keys(exception.errors ?? {}),
}
```

不要記錄：

- Validation value
- Password
- 完整 request body
- Stack trace

### 8.3 一般 HttpException

依 status 決定 level，只記錄：

- event
- requestId
- statusCode
- exception type
- 安全的 message

### 8.4 未預期錯誤

```ts
logger.error(
  {
    event: 'http.unexpected_error',
    statusCode: 500,
    err: exception,
  },
  'Unexpected HTTP error',
);
```

Client 固定收到安全內容：

```json
{
  "code": 5000,
  "data": null,
  "message": "發生非預期錯誤",
  "error": null
}
```

## 9. 第三階段：Application Events

### 9.1 Auth

| Event | Level | 建議欄位 |
|---|---|---|
| `auth.signup_succeeded` | info | `userId` |
| `auth.signup_conflict` | warn | `reason` |
| `auth.login_succeeded` | info | `userId` |
| `auth.login_failed` | warn | `reason` |
| `auth.logout_succeeded` | info | `userId` |

禁止記錄：

- Password
- Session ID
- Cookie
- 完整 Email

如有關聯 Email 的需求，使用不可逆 `emailHash`，不要直接保存 Email。

### 9.2 Session

| Event | Level | 建議欄位 |
|---|---|---|
| `session.created` | info/debug | `userId`, `expiresAtMs`, `generation` |
| `session.rotated` | info/debug | `userId`, `generation`, `gracePeriodMs` |
| `session.grace_accepted` | debug | `userId` |
| `session.device_evicted` | info | `userId`, `reason` |
| `session.not_found` | debug | `reason` |
| `session.malformed` | warn | `reason` |
| `session.revoked` | info/debug | `userId`, `deleted`, `reason` |

不可記錄 raw Session ID、Session ID Hash、`previousSessionIdHash` 或 Redis Session key。`familyId` 若不是排查所必需也不記錄；需要關聯時先定義專用的不可逆、低權限 observability ID。

### 9.3 Redis

取代 `RedisService` 的 `console.error()`：

| Event | Level |
|---|---|
| `redis.connected` | info |
| `redis.ready` | info |
| `redis.reconnecting` | warn |
| `redis.client_error` | error |
| `redis.disconnected` | warn |
| `redis.closed` | info |

Redis error 使用：

```ts
logger.error({ event: 'redis.client_error', err: error }, 'Redis client error');
```

### 9.4 Prisma

| Event | Level |
|---|---|
| `prisma.connected` | info |
| `prisma.disconnected` | info |
| `prisma.connection_failed` | error |

初期不要開啟完整 SQL query logging，SQL 與 parameters 可能包含 Email 或其他 PII。

未來若要做 slow query log，只記錄：

- model
- action
- durationMs
- threshold

不要記錄 query parameters。

### 9.5 Socket.IO

| Event | Level |
|---|---|
| `socket.connected` | info/debug |
| `socket.disconnected` | info/debug |
| `socket.auth_failed` | warn |
| `socket.room_joined` | info/debug |
| `socket.room_denied` | warn |
| `socket.command_received` | debug |
| `socket.command_succeeded` | info/debug |
| `socket.command_failed` | warn/error |
| `socket.recovered` | info |
| `socket.resync_required` | warn |

可使用：

```ts
{
  socketId,
  userId,
  boardId,
  commandId,
  eventName,
  disconnectReason,
  recovered,
  durationMs,
}
```

不要記錄完整 Socket payload。

## 10. Error Ownership 與避免重複 Log

建議 ownership：

```text
HTTP request
  → HttpExceptionFilter 記錄最終 exception

Socket event
  → Socket handler 記錄最終 ack outcome

Redis / Prisma lifecycle
  → 各自 Service 記錄連線狀態
```

避免：

```ts
try {
  await operation();
} catch (error) {
  logger.error(error);
  throw error;
}
```

若上層仍會記錄相同錯誤，這會造成同一個 exception 在 Repository、Service、Controller、Filter 重複出現。

Service 只記錄有業務、安全或狀態轉換意義的事件，不記錄每個 method enter/exit。

## 11. 第四階段：測試與 CI

### 11.1 自動化測試

至少驗證：

1. Validation log 只有欄位名稱，不包含 password value。
2. Authorization、Cookie、Set-Cookie 都被 redact。
3. 500 log 包含 server-side stack。
4. 500 response 不包含 stack。
5. Response `X-Request-ID` 與 log `requestId` 相同。
6. Login success/failure 使用正確 level 與 event。
7. Redis error 使用 `err` serializer。
8. Production 每筆 log 都是合法的單行 JSON。
9. Development 使用 pretty format。

測試不應 snapshot 完整 timestamp、PID 或動態 request ID，只驗證必要欄位與敏感資料不存在。

### 11.2 禁止 console

ESLint 加入：

```ts
'no-console': 'error'
```

CI 額外檢查：

```sh
rg "console\\." backend/src
```

預期沒有結果。

## 12. 第五階段：Production 保存與查詢

初期：

```text
NestJS JSON stdout
→ Docker 或 systemd
```

後續：

```text
NestJS JSON stdout
→ Promtail / Alloy
→ Loki
→ Grafana
```

Side project 建議：

- Log 保留 7～14 天。
- 單一 Docker log file 最大 10 MB。
- 保留 3～5 個 rotated files。
- 針對 5xx、Redis disconnect、啟動失敗建立 alert。
- 不使用 log 計算高頻 metrics，另用 metrics 系統處理。

## 13. 實作順序

### Milestone 1：HTTP 基礎

- [ ] 新增 `LOG_LEVEL`、`SERVICE_NAME`、`APP_VERSION`。
- [ ] 設定 base fields。
- [ ] 產生與回傳 request ID。
- [ ] 設定 HTTP serializers。
- [ ] 完成 sensitive fields redaction。

### Milestone 2：Exception Filter

- [ ] Filter 改用 `APP_FILTER` 與 DI。
- [ ] 注入 Pino logger。
- [ ] 移除 Filter 的 `console.*`。
- [ ] 區分 expected 4xx 與 unexpected 5xx。
- [ ] 確保 500 response 不洩漏 stack。

### Milestone 3：Dependencies

- [ ] Redis lifecycle logs。
- [ ] Prisma lifecycle logs。
- [ ] 定義 dependency error event。

### Milestone 4：Auth 與 Session

- [ ] Signup events。
- [ ] Login success/failure events。
- [ ] Logout event。
- [ ] Session lifecycle events。
- [ ] 確認不記錄 Email、Password、Session ID。

### Milestone 5：Socket.IO

- [ ] Connect/disconnect logs。
- [ ] Socket authentication logs。
- [ ] Room authorization logs。
- [ ] Command ID 與 ack outcome logs。
- [ ] Recovery/resync logs。

### Milestone 6：Tests 與 CI

- [ ] Redaction tests。
- [ ] Request ID tests。
- [ ] Exception logging tests。
- [ ] Production JSON tests。
- [ ] ESLint 禁止 `console.*`。

### Milestone 7：Deployment

- [ ] Nginx 傳遞 `X-Request-ID`。
- [ ] 設定 log rotation。
- [ ] 接入 Loki/Grafana。
- [ ] 建立 5xx 與 dependency failure alerts。

## 14. 第一階段驗收條件

完成 Milestone 1～2 後，必須符合：

- 每個 HTTP request log 都有 request ID。
- Response 帶有相同 `X-Request-ID`。
- Development log 易讀，production log 是合法 JSON。
- Validation 400 不記錄輸入值。
- 401、403、409 使用一致的 structured log。
- 500 在 server log 有 stack，client response 沒有 stack。
- 任意 log 都找不到 password、Cookie、raw session ID 或 token。
- `backend/src` 不再使用 `console.*`。
- 同一個 exception 不會被不同層重複記錄。
