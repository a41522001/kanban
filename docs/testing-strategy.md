# Backend 與 Frontend 測試策略

## 1. 目標

用最少但有意義的測試覆蓋 business branches、transport contract、database integration 與多人即時協作行為，避免只追求 coverage 百分比。

## 2. 測試分層

### Unit Test

測試單一 class 或 pure function，外部 dependency 使用 mock。

適合：

- AuthService branch。
- SessionService hash、parse 與 delete 行為。
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
- [x] Logout deletes session。

### SessionService

- [ ] Save 產生不可預測 session ID。
- [ ] Repository 只收到 hash，不收到 raw session ID。
- [ ] Get valid JSON。
- [ ] Get missing session。
- [ ] Get malformed JSON。
- [ ] Delete。

### Common

- [ ] Validation formatter。
- [ ] AppException。
- [ ] HttpExceptionFilter。
- [ ] WrapResponseInterceptor。
- [ ] Cookie options development/production。

### Guard

- [ ] Missing Cookie。
- [ ] Cookie type invalid。
- [ ] Session missing/expired。
- [ ] Session valid and request.userId assigned。

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

- Auth store state transitions。
- API error mapping。
- Form validation rendering。
- Socket ack state machine。

### Component

- Login/Signup submit、loading、field errors、general error。
- Route guard redirect。
- Logout state reset。

### Playwright

- Signup → Login → Refresh → UserInfo → Logout。
- Cookie 由瀏覽器保存，但 JavaScript 無法讀取 HttpOnly Cookie。
- 未登入無法進入 protected route。
- 兩個 browser contexts 的 Board 同步。

## 9. CI Pipeline

建議順序：

1. Install with frozen lockfile。
2. Type-check。
3. Lint。
4. Unit tests。
5. Build。
6. 啟動 PostgreSQL/Redis。
7. Migration deploy。
8. Integration tests。
9. Playwright。

## 10. 驗收條件

- Unit test 不依賴本機 development DB。
- Integration test 可在全新環境重複執行。
- 測試失敗能指出 business branch，而不是只顯示 timeout。
- CI 不輸出 Password、Cookie、Session ID。
- 同一套指令可在 Windows 開發機與 Linux CI 執行。

