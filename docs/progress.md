# 學習與實作進度

最後檢視：2026-09-21（依目前原始碼、Project／BoardColumn scoped build 與 tests、Frontend type-check，以及先前套用 11 個 migrations 的隔離 PostgreSQL／Redis E2E 核對；第 12 個 migration 尚待 E2E deploy）。

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
| Pino HTTP log 與 Swagger | 已完成基礎 | Controller class 已有 tags／Cookie auth，多數既有 handlers 有 operation 與成功／錯誤描述，request DTO 有欄位 metadata；新 pin handler 尚缺 endpoint-specific Swagger metadata，共用 response envelope decorator、FieldError schema 與 application lifecycle logging tests 待補 |
| Workspace 基礎 API | 已完成部分 | 建立、列出、成員清單已完成；Workspace 成員角色調整、移除與離開尚未補，Project create／addMember 已由獨立 Controller 提供 |
| Frontend Workspace／Project overview | 已完成第一版 | 工作區列表、建立／切換與成員摘要保留在同一 overview；Project list、置頂／取消置頂、搜尋／狀態篩選、建立 Project、desktop master-detail、mobile／tablet accordion、按 Project ID lazy-load 成員及明確進入 Project 已串接。Project 頁使用 `ProjectView` 與 `/projects/:projectId`；Workspace View 仍會管理 Socket room 並同步 Workspace 成員 |
| Workspace Invitation | 已完成發送、詳細資訊、接受與拒絕 Backend API 及前端回覆 | Controller 提供 invite／detail／accept／decline；接受流程以條件式 ACCEPTED 更新與建立 membership 同 transaction 執行，拒絕流程條件式更新為 DECLINED。Owner 取消及並行唯一性尚未完成 |
| Invitation expiration scheduler | 已實作，驗收待補 | `@nestjs/schedule` 每分鐘把 `status=PENDING AND expiresAt<=now` 批次更新為 EXPIRED；單一 instance 以 `waitForCompletion` 防止 job 重疊 |
| Frontend Invitation／Notification | 已完成第一版 | 邀請 Dialog、通知列表、邀請詳細 Dialog、未讀 badge、單筆／全部已讀、接受／婉拒、處理中鎖定與成功／錯誤狀態已完成；接受成功後同時刷新通知與 Workspace read model。Socket 通知透過集中式 notification effect／resource sync handler 分派 domain 更新；Notification resource 只有 WorkspaceInvitation／Workspace／Project／Card，不保留 Board |
| Socket.IO Session handshake 與通知推播 | 已完成第一版 | Socket middleware 以 HttpOnly Session Cookie 驗證，將 userId 寫入 `socket.data` 並加入 user room；Workspace `workspace:into` 會驗證 membership／archivedAt 後加入 `workspace:{workspaceId}`，`workspace:leave` 負責離開；接受邀請 transaction commit 後推送 `workspace:memberChanged`，邀請通知則推送 `notification:created`；重連、快速切換競速與更完整 lifecycle 測試尚待補 |
| Frontend Auth vertical slice | 已完成核心流程 | signup、login、HttpOnly Cookie、userInfo 恢復登入、protected route、logout、前端表單驗證，以及所有 HTTP `Unauthenticated` 的統一 session 清理與導頁 |
| 前端共用 UI 基礎 | 已完成基礎 | shadcn-vue Button／AlertDialog／DropdownMenu、共用 Input、Avatar、UserMenu；持續隨功能擴充 |
| Notification read model 與即時推播 | 已完成第一版 | Notification schema、migration、shared contract、收件者列表、未讀數、單筆／全部已讀、Workspace invitation detail 與 Project member added detail API 已完成；兩種 domain flow 都在同一 transaction 建立通知，commit 後由 Socket.IO 推送 `notification:created` 摘要，前端依 notification type 導向對應 Dialog |
| Project domain | 建置中，read／create／member notification／pin 已形成前端 vertical slice | Project、ProjectMember schema／migration、shared contracts、Repository 與 runtime DTO validation 已建立；`POST /project` 在既有 transaction 建立 Project、四個預設 Columns 與 OWNER membership。pin 與 member flows 已串接；負向授權、rollback、真實併行與最新 migration E2E 仍待補 |
| BoardColumn／Card domain | BoardColumn persistence 已起步 | Project 是 Board aggregate root，沒有 Board table。Project `version`／`boardRevision`、BoardColumn schema／migration、預設四欄 shared contract 與 nested create 已完成；snapshot API、Card models、Socket commands 與直接 persistence tests 尚未完成 |
| Ack、retry、idempotency、concurrency | 尚未開始 | Socket command 階段導入 |
| Recovery／resync | 尚未開始 | Board revision 與 snapshot/replay |

## 測試現況

- Backend 目前有 Auth、User、Workspace、WorkspaceInvitation、Notification、Project、Validation、Filter 與 Session schema 的 unit／integration-style specs；WorkspaceInvitation 成功接受案例驗證 transaction 後的 `emitWorkspaceMemberChanged`，ProjectService 覆蓋 create／list／members／candidates／addMember／notification detail／pin 的主要成功與失敗分支。SocketService 本身尚無有效 room lifecycle integration test。
- SessionService、SessionRepository、Lua 輪轉、5 裝置限制與 revoke 尚未有足夠測試。
- Backend E2E 使用獨立 PostgreSQL、Redis、migration 與 `.env.e2e`；目前案例覆蓋 Auth lifecycle、邀請接受／拒絕、通知單筆／全部已讀，以及 Project 建立、候選人、addMember、member-added notification detail 與重複加入 409。
- runner 結束後會移除 E2E containers、network 與暫存 volumes；專案以 `.nvmrc` 與 CI 的 `node-version-file` 固定 Node 24.13，避免 Jest 30 在 Node 22 載入 `@nestjs/schedule` 12 ESM 時失敗。
- Frontend unit tests 目前覆蓋 signup／login pure form validation、User／Notification／Project Store、Project／WorkspaceInvitation services、Project pin request／optimistic sort、通知副作用 handler、邀請回覆卡、Project add-member／notification detail Dialog，以及共用 Alert／Loading；尚未覆蓋真實 route、Socket lifecycle 或瀏覽器 Cookie 行為。
- 2026-09-12 以專案本機執行檔執行 `vue-tsc --build`、Vitest、ESLint 與 Vite build：8 個 frontend test files、25 個 tests 全數通過，type-check／lint／production build 亦通過。Playwright CLI 以攔截的本機 API 假資料驗證桌面邀請卡、接受成功、工作區清單更新及 375px 響應式畫面。
- 2026-09-12 變更 frontend HTTP error handling 後，使用 Node 24.13 執行 `pnpm --filter frontend type-check` 與 `pnpm --filter frontend test:unit --run`：8 個 test files、25 個 tests 全數通過。Vite 顯示既有 `configLoader: 'native'` 未來相容性提醒，與測試結果及本次修改無關。
- 2026-09-12 手動驗收前端通知流程：單筆已讀、全部已讀、接受工作區邀請、婉拒工作區邀請皆通過；列表狀態與未讀 badge 會即時更新，邀請回覆成功後同步標記該通知為已讀。
- 尚未有 Playwright Auth flow；瀏覽器層的 signup → login → refresh → logout 仍是待辦。
- 2026-09-15 以 Node 24.13／pnpm 11.25 執行 `pnpm build`：contracts ESM／CJS、Frontend type-check／Vite production build、Backend Nest build 全部通過。Vite 唯一警告是 main chunk 541.55 kB，超過 500 kB 建議值。
- 2026-09-15 執行 Frontend Vitest：8 個 test files、26 tests 全部通過；仍顯示 `vitest.config.ts` extensionless import 不相容於未來 `configLoader: native` 的既有提醒。本次未重跑 ESLint 或 Playwright，兩者只保留 2026-09-12 的歷史驗收紀錄。
- 2026-09-15 執行 `pnpm test:backend:cov`：17 suites、86 tests 通過，Project 2 suites／2 tests skipped；整體 coverage 為 statements 50.09%、branches 56.7%、functions 32.94%、lines 48.86%。Project Service／Repository 幾乎沒有有效行為測試，新增程式碼使整體 coverage 較先前下降。
- 2026-09-15 執行 `pnpm test:backend:e2e`：3 suites、5 tests 全部通過。當時 runner 套用 7 個 migrations，覆蓋 Auth lifecycle、Workspace Invitation 接受／拒絕，以及 Notification 單筆／全部已讀，完成後移除 containers、network 與 volumes；這筆是歷史紀錄，2026-09-20 已增至 10 migrations／4 suites，目前 11 migrations 結果見下方 2026-09-21 紀錄。
- 2026-09-16 執行完整 `pnpm build`：contracts、Frontend type-check／Vite build、Backend Nest build 全部通過；Vite 仍只有 main chunk 541.55 kB 警告。補齊所有現有 Controller 的 Swagger metadata 後再次執行 Backend build，結果通過。
- 2026-09-16 重新執行 Backend unit tests：17 suites、86 tests 通過，Project Service／Controller 2 suites／2 tests skipped；本輪未重跑 coverage、Playwright 或隔離 E2E。
- 2026-09-16 加入集中式 notification effect／resource sync handler 與 Workspace room lifecycle 後執行 Frontend `vue-tsc --build` 與 Vitest：type-check 通過，9 個 test files／30 tests 全部通過；測試確認 Workspace resource 會刷新 Store、邀請到達時不會提早刷新，以及 Project handler 目前維持無副作用佔位。Workspace View 的 room listener 尚未有 component／real Socket.IO client test。
- 2026-09-18 完成 Frontend Project overview vertical slice後，以專案本機執行檔執行 `vue-tsc --build`、Vitest、ESLint 與 Vite production build：10 個 test files／32 tests 全部通過，type-check／lint／build 亦通過。新增測試覆蓋 Workspace 快速切換時忽略舊 Project response、Project member request 去重與快取，以及 Project 通知的 read model／成員重新同步。Vite 仍只有 main chunk 超過 500 kB 的既有警告；Codex runtime 的 PATH 指到 pnpm 11.19，因此本次未用該 binary 執行 package scripts，使用者本機與專案仍固定 pnpm 11.25.0。
- 2026-09-18 Project member candidate／addMember contract 改為 `workspaceMemberId` 後，Backend type-check、ESLint 與完整 unit tests 通過：18 suites passed、1 Controller scaffold suite skipped，89 tests passed、1 skipped；Frontend type-check 亦通過。新增 Service tests 覆蓋 OWNER 候選清單、封存 Workspace 與跨 Workspace membership 拒絕。
- 2026-09-18 Figma Generator 升至 v12，新增 `Project Member Candidate`、`Project Role Option`、`Project Add Member Dialog` 原生 Component Sets，並建立 Desktop／Mobile 與 Loading／Empty／Error／Processing 畫面；Plugin TypeScript type-check、bundle 與 28 份 Current SVG audit 通過。Figma Desktop runtime／visual check 仍需執行 `Reload` → `Generate All` 後確認。
- 2026-09-18 完成 Frontend 新增 Project member vertical slice：Workspace OWNER 可從 Project 詳情開啟 responsive Dialog，搜尋 Workspace member、辨識已加入者、選擇 EDITOR／VIEWER 並以 `workspaceMemberId` 送出；成功後強制刷新 Project member cache。Frontend type-check、production build、scoped ESLint 與 12 個 Vitest files／36 tests 通過。
- 2026-09-19 以目前專案本機執行檔重新驗證 Frontend Vitest：12 個 test files／36 tests 通過。Backend 排除 sandbox 無法 bind HTTP listener 的 `validationException.integration.spec.ts` 後，17 suites／88 tests 通過，另有 1 個 Project Controller scaffold suite skipped；完整 Backend test 的唯一失敗是環境 `listen EPERM`，不應當作業務 assertion 失敗。
- 2026-09-20 完成 Project member added notification detail vertical slice：Backend 提供以 notification id 與 recipient 驗證的 `GET /project/notificationDetail/:notificationId`；Frontend 通知選單依 `PROJECT_MEMBER_ADDED` 開啟詳細 Dialog，支援 Loading／Error retry／Loaded、角色與加入時間顯示，以及前往 Project。Frontend 13 個 test files／39 tests 通過，type-check、production build、ESLint、Oxlint 與 `git diff --check` 亦通過；瀏覽器驗證確認 Desktop `520 × 544px`、Mobile `358 × 648px` 與當時的 Board query navigation（後於 2026-09-21 改為 ProjectView route）。
- 2026-09-20 收緊公開識別碼邊界：`MemberCandidate`、候選人 SQL 與前端 fixtures 移除內部 userId，ProjectService 明確投影 `workspaceMemberId`、displayName、avatarUrl、projectRole；新增 Service／Controller 測試防止 Repository 的額外 userId 洩漏至公開 response。Contracts ESM／CJS、Backend build、Frontend type-check／39 tests／production build、Backend 排除無法在 sandbox bind listener 的既有 HTTP integration spec 後 18 suites／91 tests 均通過；完整 Backend suite 的唯一失敗仍是環境 `listen EPERM`。文件規定所有瀏覽器公開 contract 不得包含內部 `User.id`／`userId`。
- 2026-09-20 新增並實測 Project 測試：Node 24.13 下 Backend 19 suites／114 tests 全部通過；coverage 為 statements 53.55%、branches 60.03%、functions 37.01%、lines 52.75%，其中 ProjectService 為 97.36% statements／90.27% branches。隔離 PostgreSQL／Redis E2E 套用 10 個 migrations 後，4 suites／9 tests 全部通過；新增 Project suite 串起建立 Project、候選人、addMember、member-added notification detail 與重複加入 409，結束後 containers、network 與 volumes 已清除。
- 2026-09-20 同輪驗證 contracts ESM／CJS、Backend Nest build、Frontend `vue-tsc --build`、13 個 Vitest files／39 tests、Vite production build 與兩端 ESLint 皆通過。Vite main chunk 為 576.34 kB；read-only Oxlint 回報 12 個錯誤（9 個 `vi.fn` 缺明確函式型別、3 個未使用 type import），因此 frontend 完整 lint pipeline 尚未全綠。Frontend coverage 尚未配置，Playwright 仍只有 Vue starter scaffold。
- 2026-09-21 完成 Project pin vertical slice：`ProjectMember.pinnedAt`、第 11 個 migration、shared request／list contract、Repository／Service／Controller、Frontend service／Store／Workspace UI 均已串接。Backend Project Service／Controller 2 suites／36 tests 通過；Frontend Project service／store 2 files／8 tests 通過，涵蓋 pin request、optimistic `pinnedAt` 更新與排序。Pin endpoint 的 HTTP E2E 尚未補。
- 2026-09-21 將前端頁面由 `boardView/BoardView.vue` 更名為 `projectView/ProjectView.vue`，route 由 `/board` 改為 `/projects/:projectId`；Workspace overview 與 Project member added notification 導頁均改用 route param。`vue-tsc --build` 通過；Board components 與本機假資料未改。
- 2026-09-21 重新執行隔離 Backend E2E：4 suites／9 tests 全部通過，並確認包含 `20260921024927_add_project_pinned_feature` 在內的 11 個 migrations 可從空資料庫套用；runner 最後已移除 containers、network 與 volumes。
- 2026-09-21 確立 Project 為 Board aggregate root，不建立 Board table；新增 Project `version`／`boardRevision`、BoardColumn schema、第 12 個 migration 與四個預設 Columns shared contract。建立 Project 會 nested-create 預設 Columns，Notification resource 移除 `BOARD`。contracts build、Backend build、Project Service／Controller 2 suites／36 tests 與 Frontend type-check 通過；第 12 個 migration deploy 與預設四欄 persistence／rollback E2E 尚未執行。
- 根目錄新增 `.nvmrc` 固定 Node 24.13.0；CI 改為讀取此檔案，並移除與 `packageManager` 重複且會觸發 pnpm 警告的 `devEngines.packageManager` 設定。
- 2026-09-08 執行 `pnpm --filter backend exec tsc -p tsconfig.build.json --noEmit` 通過；僅有目前 Node／pnpm 版本與 package 宣告不一致的警告。
- 2026-09-08 執行 `pnpm --filter frontend type-check` 與根目錄 `pnpm build` 通過；Vite production build 完成，backend Nest build 完成。
- CI 目前配置後端 E2E 與 unit tests，未配置前端 tests、type-check、lint 或 build；本次未查詢 CI 執行結果。
- 上述較早的 2026-09-04／09-08／09-11／09-12／09-15／09-16／09-19 結果是歷史紀錄；完整 build／unit／coverage baseline 仍以 2026-09-20 為準，11 migrations 的隔離 E2E、Project pin scoped tests 與 Frontend type-check 則以 2026-09-21 紀錄為準。
- 進度只在實際跑過對應指令後標記完成，不以「已有 spec 檔」代替通過結果。

## 下一步

1. 補 Project pin endpoint-specific Swagger metadata 與 HTTP E2E，驗證 pin → list 排序、unpin、validation、非成員與封存狀態。
2. 補第 12 個 migration deploy 與 CreateProject 預設四欄 persistence／rollback E2E，再實作 `GET /project/:projectId/board` snapshot；ProjectView 目前仍使用本機假資料。
3. 建立 Card／Category／Label schema 與 Column／Card commands，改用 `projectId` contract 與 `project:{projectId}` room。
4. 補 Project 未登入／非 OWNER／跨 Workspace／他人通知存取 E2E、transaction rollback 與重複加入真實併行測試。
5. 補 expiration job unit test 與真實資料庫過期批次更新測試。
6. 完成邀請取消；補 PENDING 邀請的資料庫唯一性、錯誤授權 E2E 與併發衝突處理。
7. 補 Notification 列表 query filters，以及通知收件匣隔離／transaction rollback E2E；已讀 E2E 已完成。
8. 補 Socket.IO handshake 的 Session rotation／過期策略、`connect_error` 處理與 Origin／連線 lifecycle 測試。
9. 補 Workspace room 的 reconnect rejoin、快速切換競速、membership 移除後清理與真實 client integration tests。
10. 補通知 Socket.IO 的 reconnect／漏收 HTTP resync、跨分頁同步與真實 client integration tests。

## 已知限制

- 邀請前置查詢與過期更新位於新增 transaction 外；並行發送可能產生重複 PENDING 邀請，詳見[邀請與通知](workspace-invitation-notification.md)。
- `waitForCompletion` 只避免單一 Nest instance 的排程重疊；多 instance 部署仍可能同時掃描，雖然條件式 `updateMany` 是冪等的。
- Logout 只撤銷本次 token，尚未完整撤銷 Current／Grace family。
- User／Workspace／Notification Store reset 尚未阻止舊 in-flight response 回寫。
- Notification HTTP 尚未接 cursor／filters，預設只回最新 20 筆；過期但未讀通知仍計入未讀數。
- Notification 列表只回傳 type、resource pointer 與 read state；Workspace invitation detail API 已由 Controller 提供，前端點擊邀請通知時先標記已讀，再取得邀請狀態。Socket.IO 已提供第一版 `notification:created` 推送，但重連後重新同步、事件遺失補償與跨分頁同步仍未完成。
- Workspace View 已透過 `workspace:into`／`workspace:leave` 管理目前 Workspace room，後端加入前會驗證 membership 與 archivedAt；目前尚未處理 Socket reconnect 後 rejoin、快速切換造成的非同步 room 競速，以及成員被移除後既有 Socket 的 room 清理。`workspace:memberChanged` 只傳 Workspace ID，前端收到後重新呼叫成員清單 API。
- Project create／list／member list／addMember／pin 已有 HTTP route並完成第一版 Workspace overview 串接；create 仍只回 `null`，因此前端建立後重新取得 list 並選取第一筆。建立時後端已寫入四個 BoardColumns，但前端尚無 snapshot API，頁內仍使用假資料且 mock 的 `boardId` 尚待改為 `projectId`。置頂成功後前端以本機時間 optimistic 更新，重新載入時才以 Server 時間校正。
- Project member candidate read model 與 Frontend Dialog 已改以 `workspaceMemberId` 銜接 addMember command，shared `AssignableProjectRole` 與 runtime DTO 都只允許 EDITOR／VIEWER；Service／Controller／Frontend component／service tests 與第一版隔離 E2E 已補。Project E2E 的四個案例會沿用前一個案例建立的 `projectId`／candidate，仍應重構為自給自足的情境，並補負向授權、rollback 與真實併行驗收。
- `20260915080141_add_project_member_id` 只適用當時沒有 ProjectMember rows 的建置流程。本專案沒有需保留的舊版資料，環境已清除重建，且目前 11 個 migrations 已由隔離 E2E 從空資料庫驗證；因此不再把 legacy upgrade 視為 blocker。若未來新增保留舊資料的部署來源，必須另建 forward-only migration。

## 更新方式

每個里程碑完成後：

1. 更新狀態與仍存在的限制。
2. 寫下驗收指令、日期與結果。
3. 失敗或 skipped 的測試不能記為完成。
4. 規格與程式有差異時，先指出差異，再決定修改哪一側。
