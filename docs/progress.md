# 學習與實作進度

最後檢視：2026-09-16（依目前原始碼、完整 build、Backend unit tests、Frontend type-check 與 unit tests 核對；Backend coverage 與隔離 PostgreSQL／Redis E2E 沿用 2026-09-15 紀錄）。

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
| 統一 API response 與錯誤 | 已完成 | ValidationPipe、AppException、全域 Filter、欄位錯誤遮蔽；`Unauthenticated` 與 `ResourceNotFound` 為前端可判斷的穩定 code |
| Pino HTTP log 與 Swagger | 已完成基礎 | 現有 Controller 已有 tags、operation、Cookie auth、成功／錯誤描述，request DTO 有欄位 metadata；共用 response envelope decorator、FieldError schema 與 application lifecycle logging tests 待補 |
| Workspace 基礎 API | 已完成部分 | 建立、列出、成員清單已完成；Workspace 成員角色調整、移除與離開尚未補，Project create／addMember 已由獨立 Controller 提供 |
| Frontend Workspace overview | 已完成第一版 | 工作區列表、建立 Dialog、切換、成員摘要、loading／error／empty state 已串接；Project 區等待 Project API |
| Workspace Invitation | 已完成發送、詳細資訊、接受與拒絕 Backend API 及前端回覆 | Controller 提供 invite／detail／accept／decline；接受流程以條件式 ACCEPTED 更新與建立 membership 同 transaction 執行，拒絕流程條件式更新為 DECLINED。Owner 取消及並行唯一性尚未完成 |
| Invitation expiration scheduler | 已實作，驗收待補 | `@nestjs/schedule` 每分鐘把 `status=PENDING AND expiresAt<=now` 批次更新為 EXPIRED；單一 instance 以 `waitForCompletion` 防止 job 重疊 |
| Frontend Invitation／Notification | 已完成第一版 | 邀請 Dialog、通知列表、邀請詳細 Dialog、未讀 badge、單筆／全部已讀、接受／婉拒、處理中鎖定與成功／錯誤狀態已完成；接受成功後同時刷新通知與 Workspace read model。Socket 通知透過集中式 notification effect／resource sync handler 分派 domain 更新，Workspace 已接上，Project／Board／Card 先保留型別完整的佔位 |
| Socket.IO Session handshake 與通知推播 | 已完成第一版 | Socket middleware 以 HttpOnly Session Cookie 驗證，將 userId 寫入 `socket.data` 並加入 user room；邀請通知在 transaction commit 後推送，重連後 HTTP resync 與更完整 lifecycle 測試尚待補 |
| Frontend Auth vertical slice | 已完成核心流程 | signup、login、HttpOnly Cookie、userInfo 恢復登入、protected route、logout、前端表單驗證，以及所有 HTTP `Unauthenticated` 的統一 session 清理與導頁 |
| 前端共用 UI 基礎 | 已完成基礎 | shadcn-vue Button／AlertDialog／DropdownMenu、共用 Input、Avatar、UserMenu；持續隨功能擴充 |
| Notification read model 與即時推播 | 已完成第一版 | Notification schema、migration、shared contract、收件者列表、未讀數、單筆／全部已讀與工作區邀請詳細資訊 API 已完成；邀請流程在同一 transaction 建立通知，commit 後由 Socket.IO 推送 `notification:created` 摘要，前端以 id 去重並同步列表與未讀狀態 |
| Project domain | 建置中，已有兩個 command API | Project、ProjectMember schema／migration、shared contracts、Repository 與 runtime DTO validation 已建立；`POST /project` 建立 Project 與 OWNER membership，`POST /project/addMember` 由 Project OWNER 直接加入同 Workspace 成員，使用 unique constraint／P2002 處理重複並在 commit 後推送通知。Service 仍不回傳新 Project，list read model 未暴露，兩個 scaffold specs skipped，前端尚未串接 |
| Board／Column／Card domain | 尚未開始持久化 | 目前只有目標規格、設計稿與前端假資料；尚無 Prisma models、REST API、Socket commands 或有效測試 |
| Ack、retry、idempotency、concurrency | 尚未開始 | Socket command 階段導入 |
| Recovery／resync | 尚未開始 | Board revision 與 snapshot/replay |

## 測試現況

- Backend 目前有 Auth、User、Workspace、WorkspaceInvitation、Notification、Validation、Filter 與 Session schema 的 unit／integration-style specs；Project 的兩個 scaffold suites 仍被 skip。
- SessionService、SessionRepository、Lua 輪轉、5 裝置限制與 revoke 尚未有足夠測試。
- Backend E2E 使用獨立 PostgreSQL、Redis、migration 與 `.env.e2e`；目前案例覆蓋 Auth lifecycle、邀請接受／拒絕，以及通知單筆／全部已讀。
- runner 結束後會移除 E2E containers、network 與暫存 volumes；專案以 `.nvmrc` 與 CI 的 `node-version-file` 固定 Node 24.13，避免 Jest 30 在 Node 22 載入 `@nestjs/schedule` 12 ESM 時失敗。
- Frontend unit tests 目前覆蓋 signup／login 表單驗證、User／Notification Store、WorkspaceInvitation service、通知副作用 handler、回覆卡，以及共用 Alert／Loading。
- 2026-09-12 以專案本機執行檔執行 `vue-tsc --build`、Vitest、ESLint 與 Vite build：8 個 frontend test files、25 個 tests 全數通過，type-check／lint／production build 亦通過。Playwright CLI 以攔截的本機 API 假資料驗證桌面邀請卡、接受成功、工作區清單更新及 375px 響應式畫面。
- 2026-09-12 變更 frontend HTTP error handling 後，使用 Node 24.13 執行 `pnpm --filter frontend type-check` 與 `pnpm --filter frontend test:unit --run`：8 個 test files、25 個 tests 全數通過。Vite 顯示既有 `configLoader: 'native'` 未來相容性提醒，與測試結果及本次修改無關。
- 2026-09-12 手動驗收前端通知流程：單筆已讀、全部已讀、接受工作區邀請、婉拒工作區邀請皆通過；列表狀態與未讀 badge 會即時更新，邀請回覆成功後同步標記該通知為已讀。
- 尚未有 Playwright Auth flow；瀏覽器層的 signup → login → refresh → logout 仍是待辦。
- 2026-09-15 以 Node 24.13／pnpm 11.25 執行 `pnpm build`：contracts ESM／CJS、Frontend type-check／Vite production build、Backend Nest build 全部通過。Vite 唯一警告是 main chunk 541.55 kB，超過 500 kB 建議值。
- 2026-09-15 執行 Frontend Vitest：8 個 test files、26 tests 全部通過；仍顯示 `vitest.config.ts` extensionless import 不相容於未來 `configLoader: native` 的既有提醒。本次未重跑 ESLint 或 Playwright，兩者只保留 2026-09-12 的歷史驗收紀錄。
- 2026-09-15 執行 `pnpm test:backend:cov`：17 suites、86 tests 通過，Project 2 suites／2 tests skipped；整體 coverage 為 statements 50.09%、branches 56.7%、functions 32.94%、lines 48.86%。Project Service／Repository 幾乎沒有有效行為測試，新增程式碼使整體 coverage 較先前下降。
- 2026-09-15 執行 `pnpm test:backend:e2e`：3 suites、5 tests 全部通過。當時 runner 套用 7 個 migrations，覆蓋 Auth lifecycle、Workspace Invitation 接受／拒絕，以及 Notification 單筆／全部已讀，完成後移除 containers、network 與 volumes；目前 schema 已有 9 個 migrations，本輪尚未重跑 E2E migration deploy。
- 2026-09-16 執行完整 `pnpm build`：contracts、Frontend type-check／Vite build、Backend Nest build 全部通過；Vite 仍只有 main chunk 541.55 kB 警告。補齊所有現有 Controller 的 Swagger metadata 後再次執行 Backend build，結果通過。
- 2026-09-16 執行 Backend unit tests：17 suites、86 tests 通過，Project Service／Controller 2 suites／2 tests skipped。本輪未重跑 coverage、Playwright 或隔離 E2E。
- 2026-09-16 加入集中式 notification effect／resource sync handler 後執行 Frontend `vue-tsc --build` 與 Vitest：type-check 通過，9 個 test files／30 tests 全部通過；測試確認 Workspace resource 會刷新 Store、邀請到達時不會提早刷新，以及 Project handler 目前維持無副作用佔位。
- 根目錄新增 `.nvmrc` 固定 Node 24.13.0；CI 改為讀取此檔案，並移除與 `packageManager` 重複且會觸發 pnpm 警告的 `devEngines.packageManager` 設定。
- 2026-09-08 執行 `pnpm --filter backend exec tsc -p tsconfig.build.json --noEmit` 通過；僅有目前 Node／pnpm 版本與 package 宣告不一致的警告。
- 2026-09-08 執行 `pnpm --filter frontend type-check` 與根目錄 `pnpm build` 通過；Vite production build 完成，backend Nest build 完成。
- CI 目前配置後端 E2E 與 unit tests，未配置前端 tests、type-check、lint 或 build；本次未查詢 CI 執行結果。
- 上述較早的 2026-09-04／09-08／09-11／09-12 結果是歷史紀錄；目前 HEAD 的自動驗證基準以 2026-09-15 四筆紀錄為準。
- 進度只在實際跑過對應指令後標記完成，不以「已有 spec 檔」代替通過結果。

## 下一步

1. 將 Project create／addMember 變成可驗收 vertical slice：補 Service／Controller tests、重複加入併行測試與隔離 E2E，處理既有資料下 ProjectMember `id` migration，再實作 Project list read model、回傳 mapping與 Workspace overview 串接。
2. 補 expiration job unit test 與真實資料庫過期批次更新測試。
3. 完成邀請取消；補 PENDING 邀請的資料庫唯一性、錯誤授權 E2E 與併發衝突處理。
4. 補 Notification 列表 query filters，以及通知收件匣隔離／transaction rollback E2E；已讀 E2E 已完成。
5. 補 Socket.IO handshake 的 Session rotation／過期策略、`connect_error` 處理與 Origin／連線 lifecycle 測試。
6. 補通知 Socket.IO 的 reconnect／漏收 HTTP resync、跨分頁同步與真實 client integration tests。

## 已知限制

- 邀請前置查詢與過期更新位於新增 transaction 外；並行發送可能產生重複 PENDING 邀請，詳見[邀請與通知](workspace-invitation-notification.md)。
- `waitForCompletion` 只避免單一 Nest instance 的排程重疊；多 instance 部署仍可能同時掃描，雖然條件式 `updateMany` 是冪等的。
- Logout 只撤銷本次 token，尚未完整撤銷 Current／Grace family。
- User／Workspace／Notification Store reset 尚未阻止舊 in-flight response 回寫。
- Notification HTTP 尚未接 cursor／filters，預設只回最新 20 筆；過期但未讀通知仍計入未讀數。
- Notification 列表只回傳 type、resource pointer 與 read state；Workspace invitation detail API 已由 Controller 提供，前端點擊邀請通知時先標記已讀，再取得邀請狀態。Socket.IO 已提供第一版 `notification:created` 推送，但重連後重新同步、事件遺失補償與跨分頁同步仍未完成。
- Project create／addMember 已有 HTTP route 與 runtime DTO validation，但 create 仍只回 `null`，Repository 的兩個 list queries 尚未由 Service／HTTP 暴露，前端也未串接。addMember 採直接加入，不具接受／拒絕狀態；被加入者必須先是同一 Workspace 的有效成員。
- Shared `AddProjectMemberRequest.role` 目前仍使用完整 `ProjectRole`，會在型別層允許 OWNER；Backend DTO runtime 只接受 EDITOR／VIEWER。後續應將 shared contract 收斂為可指派角色型別，避免前後端契約不一致。
- `20260915080141_add_project_member_id` 直接對 `project_members` 新增 required UUID `id`，沒有 SQL default／回填；全新資料庫可依序套用，但已有 ProjectMember 資料的既有環境會 migration 失敗，部署前必須修正 migration 策略。

## 更新方式

每個里程碑完成後：

1. 更新狀態與仍存在的限制。
2. 寫下驗收指令、日期與結果。
3. 失敗或 skipped 的測試不能記為完成。
4. 規格與程式有差異時，先指出差異，再決定修改哪一側。
