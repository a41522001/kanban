# Backend 與 Frontend 測試策略

最後檢視：2026-09-11。已執行 `pnpm test:backend:cov`：17 suites、87 tests 通過，整體 coverage 為 statements 52.15%、branches 59.19%、functions 39.07%、lines 51.38%；`pnpm --filter backend build` 通過。加入 `@nestjs/schedule` 12 後，Node 22.18 的 `pnpm test:backend:e2e` 在 Jest 載入 ESM 前失敗，需先修復後再重新驗收。既有 build／type-check 紀錄見 [progress](progress.md)。

## 1. 目標

用最少但有意義的測試覆蓋 business branches、transport contract、database integration 與多人即時協作行為，避免只追求 coverage 百分比。

## 2. 測試分層

### Unit Test

測試單一 class 或 pure function，外部 dependency 使用 mock。

適合：

- AuthService branch。
- SessionService 建立、驗證、輪轉結果 mapping 與 revoke 行為。
- Validation formatter。
- Guards、filters、interceptors。
- Socket command handler 的 authorization 與 ack mapping。

不驗證：

- Prisma 是否真的能查 PostgreSQL。
- Redis command 是否真的成功。
- HTTP Cookie 是否真的被瀏覽器保存。

### Integration Test

使用真實 PostgreSQL、Redis 或 Nest application，驗證模組之間的契約。

適合：

- UserRepository／WorkspacesRepository + Prisma。
- SessionRepository + Redis。
- ValidationPipe + Filter + Controller。
- Cookie login/userInfo/logout flow。
- Socket.IO client/server handshake。

### E2E Test

從使用者操作角度測試完整系統。

適合：

- Playwright signup/login/logout。
- Refresh 後恢復登入狀態。
- 兩個 browser contexts 同時操作 Board。
- Disconnect/reconnect、retry、duplicate command、version conflict。

## 3. Backend Unit Test Matrix

### AuthService

- [x] Signup success。
- [x] Signup email conflict。
- [x] Login user not found。
- [x] Login wrong password。
- [x] Login success and session creation。
- [x] GetUserInfo success。
- [x] GetUserInfo not found。
- [x] Logout 呼叫 Session revoke。

### SessionService

- [ ] `saveCurrentSession` 產生不可預測的 Base64URL Session ID。
- [ ] Repository 只收到 SHA-256 Hash，不收到 Raw Session ID。
- [ ] 建立時正確計算 UTC `rotateAtMs`、`expiresAtMs` 與 `MAX_DEVICE`。
- [ ] Grace 直接驗證成功且不輪轉。
- [ ] Current 未到 `rotateAtMs` 時直接驗證成功。
- [ ] Lua 回 `MISSING` 時驗證失敗。
- [ ] Lua 回 `CURRENT`／`GRACE` 時只回 `userId`。
- [ ] Lua 回 `ROTATED` 時才回候選的新 Raw Session ID。
- [ ] Revoke 將 Raw Session ID hash，讀取 userId 後呼叫 Repository。
- [ ] Session 不存在時 revoke 為 no-op。

### Session schema

- [x] Current Redis Hash 字串欄位轉成 domain 型別。
- [x] Grace Redis Hash 字串欄位轉成 domain 型別。
- [x] 無法轉換的數字欄位 fail closed。

### SessionRepository 與 Lua integration

- [ ] 建立 Hash、`PEXPIREAT` 與 ZSET member 的結果正確。
- [ ] 已過期的 ZSET member 會先清理。
- [ ] 第六個登入淘汰最早到期的 Current 與 Previous Grace。
- [ ] 多個並行登入後 `ZCARD <= MAX_DEVICE`。
- [ ] 多個並行輪轉只有一個 `ROTATED`，其餘為 `GRACE`。
- [ ] 輪轉後舊 key 約 20 秒到期，新 key 與 ZSET score 正確。
- [ ] 無效／缺欄位 Hash 不會被信任。
- [ ] Logout／revoke 原子刪除請求攜帶的 Hash 與 ZSET member。

### Notification

- [ ] `findByRecipient` 將資料庫 Notification 投影為 public contract：不洩漏 recipient、actor、dedupe key，並將 `Date` 轉成 ISO 8601 字串。
- [ ] `GET /notifications` 與 `GET /notifications/unreadCount` 需要有效 Session，且只以 Guard 寫入的 `request.userId` 查詢。
- [ ] Workspace invitation E2E：建立邀請與 `WORKSPACE_INVITED` Notification 必須在同一 transaction；受邀者可取得通知與正確未讀數。
- [ ] 受邀者標記單筆或全部已讀後，未讀數正確變化；不得讀取或修改其他使用者的通知。

Notification 目前開放讀取 API，邀請流程已呼叫內部建立通知方法；已讀仍只有 Repository 方法。Notification 兩個 scaffold specs 為 skipped，不計入有效覆蓋。

### Workspace Invitation

- [x] 移除 WorkspaceInvitationService 的 `describe.skip`，補齊 WorkspacesService、UserService、NotificationService、PrismaService 與 Repository mocks。
- [x] 發送邀請的 Owner／Member／非成員及封存工作區權限。
- [x] 未註冊 email、自邀、既有 member 與有效 PENDING 邀請。
- [x] 過期 PENDING 條件更新、更新失敗衝突，以及建立 Invitation／Notification 的 transaction interaction。
- [x] `expirePendingInvitations` 將時間正確轉交給 Repository，並回傳批次更新筆數。
- [x] 接受 invitation 的查無 invitation、既有 member、封存 workspace、狀態衝突與成功建立 membership。
- [x] WorkspaceInvitationController 正確轉交 Session userId、workspaceId／invitationId 與 email，並回傳 invite／accept／decline 成功訊息。
- [x] 接受與拒絕 invitation 的 Controller、DTO、shared contract 與 Service use case。
- [ ] 取消 invitation use case 與 Owner 授權。
- [ ] `WorkspaceInvitationExpirationJob`：固定 UTC 時間後，驗證它呼叫 service、避免重疊的設定，以及 count 大於 0 時的可觀測行為。
- [ ] 真實 PostgreSQL：過期 PENDING 會批次轉為 EXPIRED，未過期或已回覆 invitation 不變。
- [ ] 邀請與通知 transaction rollback 的真實 PostgreSQL integration test。
- [ ] 並行邀請不產生重複有效邀請（目前缺少資料庫唯一性保護）。
- [ ] 重複接受、接受／拒絕競爭與回覆 API 的 integration／E2E 測試。
- [ ] 重新驗收 E2E happy paths：發送 → 通知 → 接受 → 加入 Workspace，以及發送 → 通知 → 拒絕 → 不加入 Workspace → 再接受回 409。排程加入前曾通過，但目前 Node 22.18／Jest 30 在 ESM 載入階段失敗。

WorkspacesService／Controller specs 已移除邀請相關 dependency 與 cases，符合重構後責任。WorkspaceInvitationService unit tests 的 transaction mock 會將同一個可辨識 tx 傳入 callback，並驗證 Invitation／Notification 或 membership 寫入收到該 tx。真實 rollback、唯一性與併發仍需 PostgreSQL integration test。

### Common

- [x] Validation formatter 與 sensitive value 遮蔽。
- [x] ValidationPipe 拒絕額外欄位。
- [x] ValidationPipe + HttpExceptionFilter HTTP integration。
- [x] HttpExceptionFilter 保留 AppException 並隱藏未知錯誤。
- [ ] AppException 單獨的 constructor／default 測試。
- [ ] WrapResponseInterceptor。
- [ ] Cookie options development/production。

### Guard

- [ ] Missing Cookie。
- [ ] Cookie type invalid。
- [ ] Session missing/expired。
- [ ] Session valid and request.userId assigned。
- [ ] `ROTATED` 時只設定一次新 Cookie，其他狀態不設定。

## 4. Integration Test Infrastructure

建議使用獨立 test database 與 Redis DB，不共用 development data。

~~~env
NODE_ENV=test
DATABASE_URL=postgresql://.../kanban_test
REDIS_URL=redis://localhost:6379/1
~~~

原則：

- 測試前套用 migration。
- 每個 test suite 清理自己的資料。
- 不對 development database 執行 truncate。
- 測試資料使用固定 factory。
- Integration test 可 serial 執行，避免共享 DB 互相污染。
- CI 與本機目前都透過 Docker Compose 啟動隔離 PostgreSQL 與 Redis。

目前 Backend E2E 使用 `compose.e2e.yml` 啟動隔離的 PostgreSQL 與 Redis，並由 `scripts/runBackend.e2e.mjs` 依序執行 health check、migration、Jest 和 teardown。`E2E_ENV=true` 會讓 Prisma 與 Nest 讀取 `backend/.env.e2e`；本機可由 `.env.e2e.example` 複製，GitHub Actions 也會在測試前建立該檔案。

目前 E2E 分為 `auth.e2e.spec.ts` 與 `workspaceInvitation.e2e.spec.ts`。Auth suite 使用同一個 Supertest agent 驗證 signup → login → `GET /user/userInfo` → logout → `GET /user/userInfo` 401 的 HttpOnly Cookie flow；邀請 suite 使用邀請人／受邀人兩個 agent，驗證通知中的 `resourceId` 可用於接受或拒絕、接受後 Workspace role 為 MEMBER、拒絕後不加入且不能再接受。`afterAll` 關閉 Nest application，讓 Prisma 與 Redis module lifecycle 一起釋放資源。

## 5. Test Data Factory

建立集中 factory，避免每個 test 重複 User object：

~~~ts
buildUser({
  id,
  email,
  displayName,
  passwordHash,
})
~~~

Factory 預設值必須合法，test 只 override 與情境有關的欄位。

## 6. Mock 原則

- Mock dependency，不 mock 被測 class 自己。
- 驗證重要 interaction 的參數與次數。
- 不只驗證回傳值，也驗證副作用是否發生或未發生。
- Mock 回傳值必須符合真實 contract。
- 避免只為了讓測試通過而回傳任意 object。
- 密碼測試可先使用低 rounds 真實 bcrypt；需要更快時再抽象 PasswordHasher。

## 7. Coverage

Coverage 是偵測漏測分支的工具，不是目標。

初期門檻建議：

- Statements：70%
- Branches：70%
- Functions：70%
- Lines：70%

Auth、Session、authorization、idempotency、concurrency 等高風險模組要求完整 branch coverage。

## 8. Frontend Test

### Unit

- [x] Auth／User Store session restore、request 去重與 reset。
- [x] Login／Signup form validation pure functions。
- [ ] API error mapping 共用層。
- Socket ack state machine。

### Component

- [ ] Login/Signup submit、loading、field errors、general error。
- [ ] Route guard redirect。
- [ ] Logout state reset。

### Playwright

- [ ] Signup → Login → Refresh → UserInfo → Logout。
- Cookie 由瀏覽器保存，但 JavaScript 無法讀取 HttpOnly Cookie。
- 未登入無法進入 protected route。
- 兩個 browser contexts 的 Board 同步。

## 9. CI Pipeline

目前 GitHub Actions 配置以下步驟（本次未查詢實際 run）：

1. pnpm install --frozen-lockfile。
2. Prisma generate。
3. 由 `.env.e2e.example` 建立 `.env.e2e`。
4. Backend E2E。
5. Backend unit tests。

後續目標順序：

1. Install with frozen lockfile。
2. Type-check。
3. Lint。
4. Unit tests。
5. Build。
6. Playwright。

## 10. 驗收條件

- Unit test 不依賴本機 development DB。
- Integration test 可在全新環境重複執行。
- 測試失敗能指出 business branch，而不是只顯示 timeout。
- CI 不輸出 Password、Cookie、Session ID。
- 同一套指令可在 Windows 開發機與 Linux CI 執行。

目前 workflow 觸發條件為 push 到 main、dev、feature/*，以及 workflow_dispatch；未配置 pull_request。前端驗證與 type-check／lint／build 尚未納入 CI。

## 11. 目前最優先的測試順序

1. Workspace 邀請／通知授權、transaction rollback 與並行發送 integration／E2E。
2. Frontend Auth／邀請／通知的 component tests，以及登出時 in-flight request 競態。
3. SessionService unit tests：驗證分支與 Lua reply mapping。
4. 真實 Redis 的 create／rotate／revoke Lua integration tests，包含並行競爭。
5. Socket.IO Session handshake integration tests。
6. Frontend Auth 與 Socket.IO handshake 完成後加入 Playwright multi-user tests。
