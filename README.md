# Flowboard Kanban

最後檢視：2026-09-21（依目前原始碼、Project／BoardColumn scoped build 與 tests、Frontend type-check，以及前 11 個 migrations 的隔離 PostgreSQL／Redis E2E 核對；第 12 個 migration 尚待 E2E deploy）。

多人協作 Kanban 練習專案，主線是 Redis Session、權限、Socket.IO、ack、冪等、併發與重連恢復。目前已有 Auth、Workspace、邀請通知、user room 通知推播、Workspace room 成員同步，以及 Project 的前後端第一版 vertical slice；Project 作為 Board aggregate root，BoardColumn 持久化第一步已完成，snapshot、Card 與即時協作仍待實作。

## 專案結構

| 路徑 | 用途 |
| --- | --- |
| `frontend/` | Vue 3、TypeScript、Vite、Pinia、Tailwind CSS、Reka UI、vue-i18n |
| `backend/` | NestJS、Prisma、PostgreSQL、Redis、Socket.IO、Pino、Swagger |
| `packages/contracts/` | 共用 HTTP／Socket 型別與 runtime enum，輸出 ESM／CJS |
| `docs/` | 現行行為、目標規格、學習進度與驗收紀錄 |
| `design/`、`figma-plugin/` | 視覺稿與 Figma Development Plugin |
| `scripts/` | 隔離 Backend E2E 執行工具 |

## 目前功能

- Signup、login、userInfo、logout；前端表單驗證、Session 恢復與 protected route。
- HttpOnly Cookie 保存 raw Session ID；Redis 使用 SHA-256 hash key。具備 request-driven rotation、20 秒 Grace、裝置上限與最小 revoke。
- Workspace 建立、列表、切換、成員查詢；後端檢查 membership 與封存狀態。
- Workspace Owner 可邀請已註冊使用者；邀請與通知在同一 PostgreSQL transaction 建立。
- Workspace Invitation 已提供發送、接受與拒絕 Backend API；接受流程只在條件式轉為 ACCEPTED 成功後，才於同一 transaction 建立 WorkspaceMember，拒絕流程則條件式轉為 DECLINED。
- Nest 排程每分鐘批次將 `expiresAt <= now` 的 PENDING invitation 改為 EXPIRED；操作端仍保留 `expiresAt` 條件，避免等待下一輪排程期間接受或拒絕過期邀請。
- 通知列表、未讀數、單筆／全部已讀 API 與前端通知選單；新通知會在 transaction commit 後推送至收件者 user room。Workspace invitation 與 Project member added 都可由通知內容開啟各自的 domain detail UI。
- 統一 API response、validation、exception filter、HTTP log redact 與 Swagger；現有 Controller 已補上 tags、operation、Cookie auth、成功／錯誤狀態描述，request DTO 亦有欄位說明與範例。
- Socket.IO 已有 typed echo、Session Cookie handshake、`socket.data.userId`、server-managed user room，以及經 membership／archivedAt 驗證的 Workspace room `workspace:into`／`workspace:leave` 與 `workspace:memberChanged` 廣播。
- Project／ProjectMember 已有 Prisma schema、migration、shared contracts、Repository 與 runtime DTO validation；`POST /project`、`GET /project/:workspaceId`、`GET /project/:projectId/members`、`GET /project/:projectId/memberCandidates`、`POST /project/addMember`、`GET /project/notificationDetail/:notificationId` 與 `PATCH /project/:projectId/pin` 已提供第一版 API。`pinnedAt` 是每位 ProjectMember 自己的列表偏好，Project list 會將置頂項目排在前面；前端已支援置頂／取消置頂與重新排序。建立 Project 會在同一 transaction 建立 OWNER membership；addMember 允許 Project OWNER 將同一 Workspace 的既有成員直接加入 Project，並在 transaction commit 後推送 `PROJECT_MEMBER_ADDED` 通知。收件者點擊通知後可取得最新 Project／Workspace／角色／加入時間並前往專案。
- Project 是 Board aggregate root，不建立獨立 Board table。Project 已加入 `version`、`boardRevision` 與 `BoardColumn` schema／migration；建立 Project 時會在既有 transaction 內建立四個預設 Columns 與 OWNER membership。Notification resource 已移除 `BOARD`，看板層級使用 `PROJECT`。
- 前端 Project 頁使用 `/projects/:projectId` 與 `ProjectView.vue`；目前仍呈現本機 Board 假資料，snapshot API 與 Card schema 尚未建立。

尚未完成：邀請取消、通知 query 分頁、Project detail／角色調整／移除成員 API、Project 與置頂功能的負向 HTTP E2E／rollback／真實併行測試、Board snapshot、Card 資料模型、Column／Card commands、Project room authorization、ack／retry／idempotency／recovery。Socket 尚缺 handshake rotation 安全策略、Workspace room 重連後 rejoin、快速切換 room 的競速處理、membership 被移除後的 room 清理、前端 `connect_error` 與真實 lifecycle tests；ProjectView 內的 Board 畫面目前使用本機假資料。

## 本機啟動

需要 Node.js 24.13.0、pnpm 與可用的 Docker。專案以 `.nvmrc` 固定 Node 版本；若使用 nvm，進入專案後執行 `nvm use`。根目錄 `packageManager` 指定 pnpm 11.25.0，CI 也讀取 `.nvmrc`。

以下指令在專案根目錄執行。首次建立設定檔，已存在時請直接編輯，避免覆蓋本機設定：

```powershell
Copy-Item backend/.env.example backend/.env
```

設定 `backend/.env` 的 PostgreSQL 帳密、`DATABASE_URL` 與 `REDIS_URL`；Docker Compose 與後端使用的資料庫帳密必須一致。另建立 `frontend/.env`（目前 example 檔為空），內容為：

```dotenv
VITE_API_URL=http://localhost:4001
```

```sh
pnpm install
docker compose up -d
pnpm --filter backend exec prisma generate
pnpm --filter backend exec prisma migrate deploy
```

PostgreSQL／Redis 就緒後，分別在兩個 terminal 啟動：

```sh
pnpm dev:backend
pnpm dev:frontend
```

- 前端登入頁：`http://localhost:5173/login`。目前沒有根路由 redirect。
- 登入成功提示確認後進入 `/workspace`。
- 後端：`http://localhost:4001`，API 沒有 `/api` 全域前綴。
- Swagger：`http://localhost:4001/api/docs`。
- PostgreSQL／Redis：`localhost:5432`／`localhost:6379`。
- Compose 目前只啟動資料服務，不包含前後端應用程式。

## 開發與驗證指令

```sh
pnpm build
pnpm test:backend
pnpm --filter frontend test:unit --run
```

Backend E2E 首次先複製 `backend/.env.e2e.example` 為 `backend/.env.e2e`，再執行：

```sh
pnpm test:backend:e2e
```

runner 會建立隔離 PostgreSQL／Redis、套用 migration、執行 Auth、Workspace Invitation、Notification read-action 與 Project member flow E2E，最後移除測試 containers 與 volumes。`pnpm lint` 帶有自動修正，會修改原始碼。前端 Playwright 目前只有仍檢查 Vue starter 文案的 scaffold，尚未覆蓋產品流程。

2026-09-20 以 Node 24.13 完整驗證：Backend 19 suites／114 tests、隔離 PostgreSQL／Redis E2E 4 suites／9 tests 全部通過，10 個 migrations 可從空資料庫依序套用；coverage 為 statements 53.55%、branches 60.03%、functions 37.01%、lines 52.75%。Frontend Vitest 13 files／39 tests、type-check、兩端 production build 與 ESLint 通過；Vite main chunk 為 576.34 kB，仍超過 500 kB。Read-only Oxlint 目前有 12 個錯誤，集中在測試 mock 缺明確函式型別與未使用 type imports，因此 frontend 的完整 lint pipeline 尚未全綠；前端也尚未配置 coverage，Playwright 仍是 scaffold。詳細缺口見[進度](docs/progress.md)與[測試策略](docs/testing-strategy.md)。

2026-09-21 scoped 驗證：Project Service／Controller 2 suites／36 tests、Frontend Project service／store 2 files／8 tests 與 Frontend type-check 通過；隔離 E2E 4 suites／9 tests 通過，並確認包含 `20260921024927_add_project_pinned_feature` 在內的 11 個 migrations 可從空資料庫依序套用。現有 E2E 尚未直接呼叫 pin endpoint。

2026-09-21 BoardColumn scoped 驗證：contracts build、Backend build、Project Service／Controller 2 suites／36 tests與 Frontend type-check 通過。第 12 個 `20260921083115_add_project_board_structure` migration 已建立，但尚未重新執行完整隔離 E2E；目前測試也尚未直接斷言建立 Project 會寫入四個預設 Columns。

## 文件入口

- [文件索引](docs/README.md)
- [目前 HTTP API](docs/http-api.md)
- [Workspace 邀請與通知](docs/workspace-invitation-notification.md)
- [資料庫 Schema](docs/database-schema.md)
- [Session 架構](docs/session-architecture.md)
- [Socket.IO 學習路線](docs/socketio/00-kanban-roadmap.md)
