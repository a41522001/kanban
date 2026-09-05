# Backend 與 Frontend 測試策略

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

- AuthRepository + Prisma。
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

Notification 目前只有讀取 API 的最小實作。兩個 Nest scaffold spec 刻意 skipped，避免把沒有 mock dependency 的 `should be defined` 誤當成 coverage；等待 Workspace Invitation 實作後再補上述情境。

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
- CI 使用 service containers 啟動 PostgreSQL 與 Redis。

目前 Backend E2E 使用 `compose.e2e.yml` 啟動隔離的 PostgreSQL 與 Redis，並由 `scripts/runBackend.e2e.mjs` 依序執行 health check、migration、Jest 和 teardown。`E2E_ENV=true` 會讓 Prisma 與 Nest 讀取 `backend/.env.e2e`；本機可由 `.env.e2e.example` 複製，GitHub Actions 也會在測試前建立該檔案。

目前 E2E 覆蓋 signup → login → `GET /user/userInfo` → logout → `GET /user/userInfo` 401，使用同一個 Supertest agent 驗證 HttpOnly Cookie flow。`afterAll` 關閉 Nest application，讓 Prisma 與 Redis module lifecycle 一起釋放資源。

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

目前 GitHub Actions 已執行：

1. 安裝 dependencies。
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

## 11. 目前最優先的測試順序

1. Frontend Auth vertical slice 的 unit／component tests。
2. SessionService unit tests：驗證分支與 Lua reply mapping。
3. 真實 Redis 的 create／rotate／revoke Lua integration tests，包含並行競爭。
4. Socket.IO Session handshake integration tests。
5. Frontend Auth 與 Socket.IO handshake 完成後加入 Playwright multi-user tests。
