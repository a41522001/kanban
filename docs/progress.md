# 學習與實作進度

最後檢視：2026-09-10（依原始碼與 Backend unit tests 核對）。

## Native WebSocket

| 章節 | 主題 | 狀態 |
| --- | --- | --- |
| 01 | Connection lifecycle | 已完成 |
| 02 | JSON protocol | 已完成 |
| 03 | Broadcast 與 server push | 已完成 |
| 04 | Presence／online count | 已完成 |
| 05 | Application heartbeat | 已完成 |
| 06 | Basic reconnect | 已完成 |
| 07 | Runtime validation | 已完成 |
| 08 | Heartbeat timeout | 已完成 |
| 09 | Reconnect policy | 下一章 |
| 10 | Backpressure | 尚未開始 |

## Flowboard Kanban

| 項目 | 狀態 | 說明 |
| --- | --- | --- |
| pnpm monorepo、NestJS、PostgreSQL、Redis | 已完成 | frontend、backend、contracts 已建立 |
| Auth HTTP API | 已完成 | signup、login、`GET /user/userInfo`、logout |
| Session 建立與 Hash schema | 已完成 | Raw ID 只在 Cookie，Redis 使用 SHA-256 Hash key |
| Session 輪轉 | 已完成核心流程 | 15 分鐘 request-driven rotation、20 秒 Grace、Lua 原子競爭 |
| 5 裝置限制 | 已完成核心流程 | ZSET + create Lua 原子清理與淘汰 |
| Session revoke／logout | 已完成最小版本 | `revokeSession` Lua 原子刪除請求攜帶的 Session Hash 與使用者 ZSET member；Controller 一律清除 Cookie |
| 統一 API response 與錯誤 | 已完成 | ValidationPipe、AppException、全域 Filter、欄位錯誤遮蔽 |
| Pino HTTP log 與 Swagger | 已完成基礎 | application lifecycle events 與 logging tests 待補 |
| Workspace 基礎 API | 已完成部分 | 建立、列出、成員清單；Project API 與完整成員管理尚未補 |
| Frontend Workspace overview | 已完成第一版 | 工作區列表、建立 Dialog、切換、成員摘要、loading／error／empty state 已串接；Project 區等待 Project API |
| Workspace Invitation | 已完成發送與接受核心 use case | 邀請 Controller／Service 已移至 WorkspaceInvitation module，單向依賴 WorkspacesService；接受流程以條件式 ACCEPTED 更新與建立 membership 同 transaction 執行。接受 HTTP API／前端操作、拒絕／取消及並行唯一性尚未完成 |
| Frontend Invitation／Notification | 已串接第一版 | 邀請 Dialog、通知列表、未讀 badge、開啟選單重新整理；尚無回覆、已讀與分頁操作 |
| 最小 Socket.IO typed echo | 已完成 | 尚未接 Session handshake |
| Frontend Auth vertical slice | 已完成核心流程 | signup、login、HttpOnly Cookie、userInfo 恢復登入、protected route、logout 與前端表單驗證 |
| 前端共用 UI 基礎 | 已完成基礎 | shadcn-vue Button／AlertDialog／DropdownMenu、共用 Input、Avatar、UserMenu；持續隨功能擴充 |
| Notification read model | 已完成最小版本 | Notification schema、migration、shared contract、收件者列表與未讀數 API 已完成；邀請流程已呼叫內部 Service 建立通知；Repository 已有已讀方法，但 Service／Controller 尚未開放 |
| Board／Project domain | 尚未開始 | 依 domain 與 WebSocket spec 實作 |
| Ack、retry、idempotency、concurrency | 尚未開始 | Socket command 階段導入 |
| Recovery／resync | 尚未開始 | Board revision 與 snapshot/replay |

## 測試現況

- Backend 目前有 Auth、User、Workspace、WorkspaceInvitation、Validation、Filter 與 Session schema 的 unit／integration-style specs。
- SessionService、SessionRepository、Lua 輪轉、5 裝置限制與 revoke 尚未有足夠測試。
- Backend E2E 已使用獨立 PostgreSQL、Redis、migration 與 `.env.e2e`；目前覆蓋 signup → login → userInfo → logout → userInfo 401。
- `pnpm test:backend:e2e` 已在本機與 GitHub Actions 跑過；runner 結束後會移除 E2E containers、network 與暫存 volumes。
- Frontend unit tests 目前覆蓋 signup／login 表單驗證、User Store 的 session restore 去重與 reset、共用 Alert／Loading；2026-09-04 執行 `pnpm --filter frontend test:unit --run`，共 5 個檔案、16 個測試通過。
- Frontend production build 於 2026-09-04 執行 `pnpm --filter frontend build` 通過。
- 尚未有 Playwright Auth flow；瀏覽器層的 signup → login → refresh → logout 仍是待辦。
- 2026-09-10 執行 `pnpm test:backend`：15 suites 通過、1 suite skipped；77 tests 通過、1 test skipped。WorkspaceInvitationService spec 已移除 skip，覆蓋發送邀請的 Owner／帳號／membership／PENDING 邀請與 transaction branches，以及接受邀請的查無邀請、既有 member、封存 workspace、狀態衝突與成功加入成員。WorkspaceInvitationController 仍尚無 spec。
- 2026-09-08 執行 `pnpm --filter backend exec tsc -p tsconfig.build.json --noEmit` 通過；僅有目前 Node／pnpm 版本與 package 宣告不一致的警告。
- 2026-09-08 執行 `pnpm --filter frontend type-check` 與根目錄 `pnpm build` 通過；Vite production build 完成，backend Nest build 完成。
- CI 目前配置後端 E2E 與 unit tests，未配置前端 tests、type-check、lint 或 build；本次未查詢 CI 執行結果。
- 上述 2026-09-04 與既有 E2E 通過紀錄是歷史紀錄，不代表目前 HEAD 重新驗證通過。
- 進度只在實際跑過對應指令後標記完成，不以「已有 spec 檔」代替通過結果。

## 下一步

1. 公開 WorkspaceInvitation 接受 HTTP API，完成拒絕／取消流程；補 PENDING 邀請的資料庫唯一性與併發衝突處理。
2. 補 Notification 的單筆已讀、全部已讀、列表 query filters，以及發送／接受邀請流程 E2E。
3. 建立 Project read model（後端 API 與前端專案清單），讓 Workspace overview 的專案區可使用真實資料。
4. 將同一套 Session 驗證接到 Socket.IO handshake，之後才讓已持久化的通知以 Socket.IO 即時推送。
5. 補 SessionService 與真實 Redis Lua integration tests。

## 已知限制

- 邀請前置查詢與過期更新位於新增 transaction 外；並行發送可能產生重複 PENDING 邀請，詳見[邀請與通知](workspace-invitation-notification.md)。
- Logout 只撤銷本次 token，尚未完整撤銷 Current／Grace family。
- User／Workspace／Notification Store reset 尚未阻止舊 in-flight response 回寫。
- Notification HTTP 尚未接 cursor／filters，預設只回最新 20 筆；過期但未讀通知仍計入未讀數。

## 更新方式

每個里程碑完成後：

1. 更新狀態與仍存在的限制。
2. 寫下驗收指令、日期與結果。
3. 失敗或 skipped 的測試不能記為完成。
4. 規格與程式有差異時，先指出差異，再決定修改哪一側。
