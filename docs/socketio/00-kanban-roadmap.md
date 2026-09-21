# Socket.IO 協作 Kanban 路線

## 狀態

進行中。專案已完成最小 Socket.IO typed echo、Session Cookie handshake、工作區邀請通知推播，以及 Workspace room 成員同步第一版。

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
- Swagger `/api/docs`；Controller class 已有 domain tags／Cookie auth，多數既有 handlers 有 operation 與主要成功／錯誤描述；Project pin handler 尚缺 endpoint-specific metadata。
- Socket.IO middleware 以 HttpOnly Session Cookie 驗證連線，將 userId 寫入 `socket.data`，並加入伺服器管理的 `user:{userId}` room。
- Workspace View 可透過 `workspace:into`／`workspace:leave` 訂閱或離開 `workspace:{workspaceId}` room；Server 加入前驗證有效 WorkspaceMember 與 archivedAt，接受邀請 commit 後向 room 推送 `workspace:memberChanged` invalidation event。
- typed `demo:echo` event 與 `notification:created` Server event。
- Frontend Auth vertical slice：signup、login、userInfo session restore、protected route、logout、表單驗證與共用 UI 基礎。
- Notification 持久化與推播基礎：PostgreSQL schema、shared contract、`GET /notifications`、`GET /notifications/unreadCount`、`PATCH /notifications/read`、`PATCH /notifications/readAll`、`GET /workspaceInvitation/:invitationId` 與 `GET /project/notificationDetail/:notificationId`；資料庫是通知真相，Workspace invitation 與 Project member added 都在 transaction commit 後以 `notification:created` 推送摘要。
- Workspace 列表／建立／成員授權查詢與前端 overview；Owner 邀請 Dialog 及通知選單已串接。
- Project／ProjectMember schema、migration、shared contracts、Repository、runtime DTO 與 create／list／members／memberCandidates／addMember／notification detail／pin HTTP endpoints；addMember 的 membership／notification 同 transaction，commit 後推送 `notification:created`。Project overview、新增成員 Dialog、Project member added notification detail Dialog 與 pin UI 已完成第一版；前端 Project 頁使用 `/projects/:projectId` 的 `ProjectView`。Project scoped unit tests 與套用 13 個 migrations 的隔離 E2E 已通過，pin HTTP E2E、負向授權、rollback 與更完整的併行測試仍待補。
- Project 是 Board aggregate root，沒有 Board table；Project `version`／`boardRevision`、BoardColumn schema／migration 與建立 Project 時的四個預設 Columns 已加入。snapshot、Card 與 Project room 尚未實作。

尚未完成的 Session 收尾：logout／revoke 僅刪除本次 Cookie 對應的 Session 與 ZSET member，尚未處理 Current／Previous Grace family 的完整撤銷；Session Lua 也尚缺真實 Redis 的並行整合測試。這些完成前，不把 Session lifecycle 標記為可上線。

2026-09-21 核對：13 個 migrations 的隔離 E2E 4 suites／9 tests、Project Service／Controller 36 tests、BoardColumn DTO 6 tests、contracts／Backend build 與 Frontend scoped tests／type-check 已通過。預設四欄內容／順序的直接 assertion 與 rollback 尚待補。下一步先完成 BoardColumn commands／拖曳與 snapshot，再建立 Card schema及 `project:{projectId}` room；Socket.IO 不作為持久化真相。

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
- [x] `PROJECT_MEMBER_ADDED` 依 notification type 導向 Project detail API，Dialog 顯示 Project／Workspace／角色／加入時間並可前往 `/projects/:projectId` 的 `ProjectView`。
- [ ] Socket 斷線、重連或漏收時，以 `GET /notifications` 與 `GET /notifications/unreadCount` 重新同步。
- [ ] 補跨分頁同步與真實 Socket.IO clients integration tests。

### 02B Workspace room 成員同步（第一版已實作）

- [x] Workspace View 依目前選取的 Workspace emit `workspace:into`，切換或離開時 emit `workspace:leave`。
- [x] Server 在加入 `workspace:{workspaceId}` 前驗證 WorkspaceMember 與 archivedAt。
- [x] 接受邀請建立 WorkspaceMember 的 transaction commit 後 emit `workspace:memberChanged` `{ workspaceId }`。
- [x] 前端只在事件 Workspace ID 等於目前選取值時，重新取得 Workspace members API。
- [ ] reconnect 後自動 rejoin、快速切換 room 的競速、成員移除後清理既有 room，以及 Socket.IO client lifecycle tests。

### 03 Project Board room 與 authorization

- 每個 Project 對應 `project:{projectId}` room。
- Join 前透過 `Project → ProjectMember` 檢查權限；不建立 BoardMember。
- Event 中的 Project／Column／Card 資源重新驗證 scope 與權限。
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
