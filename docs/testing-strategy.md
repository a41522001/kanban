# Backend 與 Frontend 測試策略

最後檢視：2026-09-21。2026-09-20 完整 Backend build／19 suites／114 tests／coverage 與 Frontend 13 files／39 tests／build baseline 見 [progress](progress.md)；2026-09-21 另驗證 Project Service／Controller 2 suites／36 tests、Frontend Project service／store 2 files／8 tests、Frontend type-check，以及可套用 11 個 migrations 的隔離 E2E 4 suites／9 tests。Pin endpoint、Workspace room、Socket lifecycle 與前端產品 Playwright E2E 仍未覆蓋。

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

- [x] `findByRecipient` 將資料庫 Notification 投影為 public contract：不洩漏 recipient、actor、dedupe key，並將 `Date` 轉成 ISO 8601 字串。
- [ ] `GET /notifications` 與 `GET /notifications/unreadCount` 需要有效 Session，且只以 Guard 寫入的 `request.userId` 查詢。
- [x] Workspace invitation E2E：受邀者可取得 `WORKSPACE_INVITED` 通知與正確未讀數；Invitation／Notification 使用同一 transaction 的 interaction 另由 unit test 驗證。
- [x] 受邀者標記單筆或全部已讀後，未讀數正確變化。
- [ ] 不得讀取或修改其他使用者通知的顯式 E2E，以及 Invitation／Notification 真實 transaction rollback。
- [ ] Socket.IO：有效 Session handshake 才能連線，邀請 transaction commit 後只向受邀者推送 `notification:created`，且 client 可用 notification id 去重。
- [ ] Workspace room：只有有效 WorkspaceMember 可加入 `workspace:{workspaceId}`；接受邀請 transaction commit 後推送 `workspace:memberChanged`，目前尚缺真實 Socket.IO client authorization／lifecycle test。

Notification 已開放列表、未讀數、單筆／全部已讀、Workspace invitation detail 與 Project member added detail API；邀請與 Project member added flow 都在同一 transaction 建立通知，commit 後以 Socket.IO `notification:created` 推送摘要。Frontend 已補 Project member added detail service／component tests，驗證 notification id 傳遞、detail 顯示、role 翻譯、retry 與前往 Project event。`markReadInvitation.e2e.spec.ts` 覆蓋受邀者單筆已讀、全部已讀與未讀數變化；`project.e2e.spec.ts` 覆蓋 addMember 後讀取通知與 detail。跨使用者收件匣隔離、真實 rollback、Socket.IO handshake、推播去重與 reconnect resync 的 integration tests 尚未完成。NotificationController 目前仍只有 defined smoke test，NotificationService 也只直接覆蓋 `findByRecipient`，是目前 HTTP domain 中較薄弱的 unit 區域。

### Workspace Invitation

- [x] 移除 WorkspaceInvitationService 的 `describe.skip`，補齊 WorkspacesService、UserService、NotificationService、PrismaService 與 Repository mocks。
- [x] 發送邀請的 Owner／Member／非成員及封存工作區權限。
- [x] 未註冊 email、自邀、既有 member 與有效 PENDING 邀請。
- [x] 過期 PENDING 條件更新、更新失敗衝突，以及建立 Invitation／Notification 的 transaction interaction。
- [x] `expirePendingInvitations` 將時間正確轉交給 Repository，並回傳批次更新筆數。
- [x] 接受 invitation 的查無 invitation、既有 member、封存 workspace、狀態衝突與成功建立 membership。
- [x] 接受 invitation 成功後驗證 transaction 完成才呼叫 `emitWorkspaceMemberChanged(workspaceId)`；SocketService mock 與 interaction assertion 已補上。
- [x] WorkspaceInvitationController 正確轉交 Session userId、workspaceId／invitationId 與 email，並回傳 invite／accept／decline 成功訊息。
- [x] 接受與拒絕 invitation 的 Controller、DTO、shared contract 與 Service use case。
- [ ] 取消 invitation use case 與 Owner 授權。
- [ ] `WorkspaceInvitationExpirationJob`：固定 UTC 時間後，驗證它呼叫 service、避免重疊的設定，以及 count 大於 0 時的可觀測行為。
- [ ] 真實 PostgreSQL：過期 PENDING 會批次轉為 EXPIRED，未過期或已回覆 invitation 不變。
- [ ] 邀請與通知 transaction rollback 的真實 PostgreSQL integration test。
- [ ] 並行邀請不產生重複有效邀請（目前缺少資料庫唯一性保護）。
- [ ] 重複接受、接受／拒絕競爭與回覆 API 的 integration／E2E 測試。
- [x] E2E happy paths：發送 → 通知 → 接受 → 加入 Workspace，以及發送 → 通知 → 拒絕 → 不加入 Workspace → 再接受回 409；以 Node 24.13 驗收通過。

WorkspacesService／Controller specs 已移除邀請相關 dependency 與 cases，符合重構後責任。WorkspaceInvitationService unit tests 的 transaction mock 會將同一個可辨識 tx 傳入 callback，並驗證 Invitation／Notification 或 membership 寫入收到該 tx。真實 rollback、唯一性與併發仍需 PostgreSQL integration test。

### Project

- [x] `ProjectService` 覆蓋 list、member candidates、membership mapping、create、members、addMember 與 member-added notification detail 的主要成功／失敗分支。
- [x] 建立 Project 時驗證 Workspace membership、封存 Workspace，以及 Project 與 OWNER membership 使用同一 transaction client；真實 rollback 仍待 integration test。
- [x] Project Controller 六個 handlers 會轉交 Session userId 與 path／body，並映射成功 response；runtime DTO validation 與錯誤 envelope 仍需 HTTP integration／E2E 驗證。
- [x] addMember service 覆蓋 Project OWNER、封存 Project、跨 Workspace membership、成功寫入 ProjectMember／Notification 與 commit 後 Socket emit interaction。
- [x] Prisma P2002 會映射為 409，且錯誤時不 emit Socket；真實並行請求、資料庫只留一筆 membership／notification 與 rollback 尚未驗證。
- [x] Member candidate public contract、Repository query 與 Service projection 只回傳 `workspaceMemberId`，測試確認即使 Repository row 含額外 userId 也不會傳到 Controller response。
- [x] Frontend `PROJECT_MEMBER_ADDED` notification detail：依 notification id 呼叫 detail API，顯示 Project／Workspace／角色／加入時間，並驗證 Loading、Error retry、Loaded 與前往 Project 行為。
- [x] Backend `getProjectMemberAddedNotificationDetail` service／controller：service 以 recipient 查通知，已有 happy path、查無通知與 Project／Workspace archived 的 unit assertions，第一版 E2E 已驗證收件者 happy path。
- [ ] Notification type／resourceType／resourceId mismatch 的獨立 fixtures，以及其他使用者拿 notification id 查詢時回 404 的 E2E。
- [x] Project list／members／memberCandidates read models 已實作，並有 Service／Controller tests；尚缺 HTTP 層未授權／封存負向 E2E。
- [x] `switchPinnedStatus` Service unit tests：置頂會寫入固定 UTC 時間，取消置頂寫入 null；非成員、Project／Workspace 封存時不更新；Repository count 為 0 時映射為 400。
- [x] `switchProjectPinnedStatus` Controller unit tests：`pinned=true/false` 都會正確轉交 projectId、Session userId 與 body，並回傳成功 envelope。
- [x] 隔離 PostgreSQL E2E：11 個 migrations 可從空資料庫套用，並驗證建立 Project、候選人、addMember、通知 detail 與重複加入 409。
- [ ] Project pin HTTP E2E：pin → list 的 `pinnedAt` 與排序、unpin、非成員、封存 Project／Workspace、非 boolean validation。
- [ ] Project 負向 E2E：未登入、非 OWNER、跨 Workspace membership、他人 notification id、封存 Workspace／Project。

ProjectMember `id` migration 當時只支援空表；本專案沒有需要保留的舊版資料，環境已重新 deploy，因此不再把 legacy upgrade test 列為目前驗收項目。若未來新增保留舊資料的部署來源，需另開 forward-only migration 與 upgrade test。

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

目前 E2E 包含 `auth.e2e.spec.ts`、`workspaceInvitation.e2e.spec.ts`、`markReadInvitation.e2e.spec.ts` 與 `project.e2e.spec.ts`。Auth suite 使用同一個 Supertest agent 驗證 signup → login → `GET /user/userInfo` → logout → `GET /user/userInfo` 401 的 HttpOnly Cookie flow；邀請 suite 使用邀請人／受邀人兩個 agent，驗證通知中的 `resourceId` 可用於接受或拒絕、接受後 Workspace role 為 MEMBER、拒絕後不加入且不能再接受；已讀 suite 覆蓋單筆與全部已讀。Project suite 使用四個 agent 串起 Workspace 邀請、建立 Project、候選人、addMember、通知 detail 與重複加入 409。2026-09-21 四個 suites／九個 tests 在隔離 PostgreSQL／Redis 通過，11 個 migrations 可從空資料庫套用；`afterAll` 關閉 Nest application，runner 最後清除 containers、network 與 volumes。Project suite 的四個 `it` 目前共享前面案例建立的 `projectId`／candidate，後續應重構為不依賴測試順序；pin route 尚未加入此 suite。

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

2026-09-20 Backend 實測 coverage：statements 53.55%、branches 60.03%、functions 37.01%、lines 52.75%，仍低於 70% 初期門檻。ProjectService 已提升至 97.36% statements／90.27% branches；主要缺口集中於 SessionService 13.79%、SocketService 14.49%、NotificationService 48.27%，以及各 Repository 的真實整合行為。Frontend 尚未安裝／配置 Vitest coverage provider，因此目前沒有可信的前端百分比。

## 8. Frontend Test

### Unit

- [x] Auth／User Store session restore、request 去重與 reset。
- [x] Login／Signup form validation pure functions。
- [x] Project Store 的 Workspace 切換競態、member request 去重與快取。
- [x] Project／WorkspaceInvitation service request mapping、notification effect handler；Project pin request 及 Store 的 `pinnedAt` optimistic update／排序已有 unit tests。
- [ ] API error mapping 共用層的 unit test：實作已完成，`getApiErrorResponse()` 驗證 Axios API envelope，`Unauthenticated` interceptor 以 app event 統一清空 session state。
- Socket ack state machine。

### Component

- [ ] Login/Signup submit、loading、field errors、general error。
- [x] Workspace invitation response card 的狀態與操作。
- [x] Project add-member Dialog 的候選人、`workspaceMemberId`／role submit 與 error retry。
- [x] Project member-added notification detail Dialog 的 loaded／error retry 與 openProject event。
- [ ] Route guard redirect。
- [ ] Logout state reset。
- [ ] Workspace View 的 Workspace room into／leave、memberChanged listener refresh 與 unmount cleanup。

### Playwright

- [ ] 以產品流程取代目前仍檢查 `You did it!` 的 Vue starter scaffold。
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

1. 補 Project pin HTTP E2E 與 Swagger contract，再補 Project 負向授權、P2002 真實併行衝突與 transaction rollback。
2. 後續建立 Board／Column／Card schema、snapshot read model 與 Board room authorization。
3. Workspace 邀請／通知授權、transaction rollback 與並行發送 integration／E2E。
4. Frontend Auth／邀請／通知的 component tests，以及登出時 in-flight request 競態。
5. SessionService unit tests：驗證分支與 Lua reply mapping。
6. 真實 Redis 的 create／rotate／revoke Lua integration tests，包含並行競爭。
7. Workspace room authorization／lifecycle integration tests，包含 reconnect rejoin 與快速切換競速。
8. Socket.IO Session handshake integration tests，再加入 Playwright multi-user tests。
