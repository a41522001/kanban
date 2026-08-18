# Socket.IO 協作 Kanban 路線

## 狀態

進行中。專案已從最小 Socket.IO typed echo 與 Auth 基礎開始實作。

## 專案目標

建立多人即時協作 Kanban，重點不是 UI，而是 session authentication、authorization、delivery semantics、concurrency 與 recovery。

## 技術選擇

- Vue 3 + TypeScript + Pinia。
- NestJS + Socket.IO。
- Redis server-side session + HttpOnly Cookie。
- PostgreSQL + Prisma。
- Pino、Swagger、runtime validation。
- Vitest 與 Playwright multi-user tests。

## 目前已完成

- pnpm monorepo：frontend、backend、`@kanban/contracts`。
- PostgreSQL + Prisma User model。
- Redis Session：隨機 session ID 只存在 HttpOnly Cookie，Redis 使用 SHA-256 hash 作 key。
- Signup、login、userInfo、logout HTTP API。
- Session Guard 將已驗證的 `userId` 放到 Express Request。
- 成功 API envelope：`code`、`data`、`message`、`time`、`error`。
- `AppException` 與全域 HTTP exception filter 骨架。
- Pino HTTP request log，並 redact Cookie、Authorization、password、Set-Cookie。
- Swagger `/api/docs`。
- 最小 Socket.IO connection 與 typed `demo:echo` event。

## 小章順序

### 01 前端 Auth vertical slice

- Login、signup UI 串接 HTTP API。
- `credentials: 'include'` 讓瀏覽器保存並帶上 HttpOnly session cookie。
- App 初始化時呼叫 `GET /auth/userInfo` 恢復登入狀態。
- Logout 清除 session 並更新前端狀態。

### 02 Session Cookie Socket.IO handshake

- Socket.IO middleware 從 handshake cookie 取得 session ID。
- Redis 驗證 session，將 `userId` 放進 `socket.data`。
- 不信任 client event payload 的 user ID。
- 未驗證連線應收到明確 connect error。

### 03 Board room 與 authorization

- 每個 board 對應 room。
- Join 前檢查 board membership。
- Event 中的 board/card 資源重新驗證權限。
- Disconnect 後 presence 正確更新。

### 04 Kanban commands 與 ack

- Create card、edit card、move card。
- Ack success、validation error、authorization error。
- Client timeout 顯示明確狀態。

### 05 Retry 與 idempotency

- 每個 command 帶 command ID。
- Retry 使用相同 ID。
- Server 對重複 command 不重複產生副作用。
- PostgreSQL unique constraint 與 transaction。

### 06 Concurrency

- Card version。
- Optimistic update。
- Version conflict。
- Server authoritative result。

### 07 Recovery 與 resync

- 區分 reconnect、recovery、resync。
- Recovery 成功時恢復 room 與漏失事件。
- Recovery 失敗時重新取得完整 board snapshot。

### 08 Tests

- Event handler unit tests。
- 真實 Socket.IO clients integration tests。
- Playwright 兩個 browser contexts。
- 斷線、retry、duplicate command 與 concurrency tests。

## 暫不處理

- Redis adapter 與多個 Socket.IO server instances。
- Nginx sticky sessions、deployment、壓測。
- RabbitMQ；等單節點 Kanban 的即時同步與一致性完成後，再用它練習非同步工作流。
- 完整產品級 UI。
