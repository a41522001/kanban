# Socket.IO 協作 Kanban 路線

## 狀態

進行中。專案已完成最小 Socket.IO typed echo、Session Cookie handshake，以及工作區邀請的通知推播第一版。

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
- Redis Session：隨機 Session ID 只存在 HttpOnly Cookie，Redis 使用 SHA-256 Hash 作 key。
- Session Current／Grace schema、15 分鐘輪轉、20 秒 Grace、5 裝置 ZSET 與原子 Lua 核心流程。
- Signup、login、userInfo、logout HTTP API。
- Session Guard 將已驗證的 `userId` 放到 Express Request。
- 成功 API envelope：`code`、`data`、`message`、`time`、`error`。
- `AppException` 與全域 HTTP exception filter 骨架。
- Pino HTTP request log，並 redact Cookie、Authorization、password、Set-Cookie。
- Swagger `/api/docs`。
- Socket.IO middleware 以 HttpOnly Session Cookie 驗證連線，將 userId 寫入 `socket.data`，並加入伺服器管理的 `user:{userId}` room。
- typed `demo:echo` event 與 `notification:created` Server event。
- Frontend Auth vertical slice：signup、login、userInfo session restore、protected route、logout、表單驗證與共用 UI 基礎。
- Notification 持久化與推播基礎：PostgreSQL schema、shared contract、`GET /notifications`、`GET /notifications/unreadCount`、`PATCH /notifications/read`、`PATCH /notifications/readAll` 與 `GET /workspaceInvitation/:invitationId`；資料庫是通知真相，Workspace 邀請在 transaction commit 後以 `notification:created` 推送摘要。
- Workspace 列表／建立／成員授權查詢與前端 overview；Owner 邀請 Dialog 及通知選單已串接。
- Project／ProjectMember schema、migration、shared contracts、Repository 與 create Service transaction；Controller、有效測試與前端尚未完成。

尚未完成的 Session 收尾：logout／revoke 僅刪除本次 Cookie 對應的 Session 與 ZSET member，尚未處理 Current／Previous Grace family 的完整撤銷；Session Lua 也尚缺真實 Redis 的並行整合測試。這些完成前，不把 Session lifecycle 標記為可上線。

2026-09-15 核對：隔離 Backend E2E 的 3 suites／5 tests 已通過，包含 Auth、邀請接受／拒絕與通知單筆／全部已讀。Socket.IO Session handshake、user room 與 transaction commit 後的 `notification:created` 推播第一版已完成；但 handshake 仍直接呼叫可能觸發 rotation 的 Session 方法且不回寫新 Cookie，需優先修正。近期主線先完成 Project HTTP vertical slice，再補邀請取消／query／併發與 Socket reconnect／漏收同步測試。Socket.IO 不作為通知真相，也不需要先導入 message queue。

## 小章順序

### 01 前端 Auth vertical slice（已完成核心流程）

- [x] Login、signup UI 串接 HTTP API。
- [x] `credentials: 'include'` 讓瀏覽器保存並帶上 HttpOnly session cookie。
- [x] 首次前往 protected route 時呼叫 `GET /user/userInfo` 恢復登入狀態。
- [x] Logout 清除 session 並更新前端狀態。
- [ ] Playwright 的瀏覽器 Auth E2E 與 redirect target。

### 02 Session Cookie Socket.IO handshake

- [x] Socket.IO middleware 從 handshake cookie 取得 session ID。
- [x] Redis 驗證 session，將 `userId` 放進 `socket.data`。
- [x] 不信任 client event payload 的 user ID。
- [x] 未驗證連線拒絕並回傳 connect error。
- [ ] 將 handshake 改為不觸發 rotation，或可靠回寫輪轉 Cookie；補過期策略、Origin allowlist 與真實連線 lifecycle tests。

### 02A Notification push（第一版已實作）

- [x] 新通知 transaction commit 後，向 `user:{userId}` room emit `notification:created`。
- [x] Event payload 只使用 `PublicNotification` 摘要，不包含 payload 或邀請詳細資料。
- [x] 前端收到事件後依 notification id 去重，更新通知列表與未讀數。
- [ ] Socket 斷線、重連或漏收時，以 `GET /notifications` 與 `GET /notifications/unreadCount` 重新同步。
- [ ] 補跨分頁同步與真實 Socket.IO clients integration tests。

### 03 Board room 與 authorization

- 每個 board 對應 room。
- Join 前透過 `Board → Project → ProjectMember` 檢查權限；不建立 BoardMember。
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
