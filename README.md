# Flowboard Kanban

最後檢視：2026-09-16（依目前原始碼、完整 build、Backend unit tests、Frontend type-check 與 unit tests 核對；coverage 與隔離 Backend E2E 沿用 2026-09-15 紀錄）。

多人協作 Kanban 練習專案，主線是 Redis Session、權限、Socket.IO、ack、冪等、併發與重連恢復。目前已有 Auth、Workspace、邀請通知、user room 通知推播與 Workspace room 成員同步第一版；Project domain 正在建置，Board 持久化與即時協作仍待實作。

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
- 通知列表、未讀數、單筆／全部已讀 API 與前端通知選單；新通知會在 transaction commit 後推送至受邀者 user room。
- 統一 API response、validation、exception filter、HTTP log redact 與 Swagger；現有 Controller 已補上 tags、operation、Cookie auth、成功／錯誤狀態描述，request DTO 亦有欄位說明與範例。
- Socket.IO 已有 typed echo、Session Cookie handshake、`socket.data.userId`、server-managed user room，以及經 membership／archivedAt 驗證的 Workspace room `workspace:into`／`workspace:leave` 與 `workspace:memberChanged` 廣播。
- Project／ProjectMember 已有 Prisma schema、migration、shared contracts、Repository 與 runtime DTO validation；`POST /project` 會建立 Project 並在同一 transaction 建立 OWNER membership，`POST /project/addMember` 允許 Project OWNER 將同一 Workspace 的既有成員直接加入 Project，並在 transaction commit 後推送通知。

尚未完成：邀請取消、通知 query 分頁、Project list／detail／角色調整／移除成員 API、Project 前端資料流與有效測試、Board／Column／Card 資料模型與 API、Board room authorization、ack／retry／idempotency／recovery。Socket 尚缺 handshake rotation 安全策略、Workspace room 重連後 rejoin、快速切換 room 的競速處理、membership 被移除後的 room 清理、前端 `connect_error` 與真實 lifecycle tests；Board 畫面目前使用本機假資料。

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

runner 會建立隔離 PostgreSQL／Redis、套用 migration、執行 Auth、Workspace Invitation 與 Notification read-action E2E，最後移除測試 containers 與 volumes。`pnpm lint` 帶有自動修正，會修改原始碼。前端 Playwright 目前只有 scaffold，尚未覆蓋完整 Auth flow。

2026-09-16 以 Node 24.13／pnpm 11.25 執行完整 `pnpm build` 通過；目前 Backend unit tests 為 17 suites／86 tests 通過，Project 2 suites／2 tests 仍 skipped。加入集中式 notification effect handler 與 Workspace room 前端 lifecycle 後，Frontend type-check 與 Vitest 9 個 test files／30 tests 通過；Backend build 亦通過。2026-09-15 的 Backend coverage 為 statements 50.09%、branches 56.7%、functions 32.94%、lines 48.86%；隔離 PostgreSQL／Redis E2E 為 3 suites／5 tests 通過。Vite build 仍有 main chunk 超過 500 kB 的警告。本輪未重跑 coverage 或 E2E，詳細缺口見[進度](docs/progress.md)與[測試策略](docs/testing-strategy.md)。

## 文件入口

- [文件索引](docs/README.md)
- [目前 HTTP API](docs/http-api.md)
- [Workspace 邀請與通知](docs/workspace-invitation-notification.md)
- [資料庫 Schema](docs/database-schema.md)
- [Session 架構](docs/session-architecture.md)
- [Socket.IO 學習路線](docs/socketio/00-kanban-roadmap.md)
