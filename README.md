# Flowboard Kanban

最後檢視：2026-09-08（依原始碼靜態核對）。

多人協作 Kanban 練習專案，主線是 Redis Session、權限、Socket.IO、ack、冪等、併發與重連恢復。目前已有 Auth、Workspace 與邀請通知基礎；Project／Board 持久化與即時協作仍待實作。

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
- 通知列表、未讀數 API 與前端通知選單。
- 統一 API response、validation、exception filter、HTTP log redact 與 Swagger。
- Socket.IO 最小 typed echo。

尚未完成：邀請接受／拒絕／取消、通知已讀 API／分頁 query、Project／Board／Card 資料模型與 API、Socket Session handshake、room authorization、ack／retry／idempotency／recovery。Board 畫面目前使用本機假資料。

## 本機啟動

需要 Node.js（frontend 宣告 `^22.18.0 || >=24.12.0`）、pnpm 與可用的 Docker。根目錄 `packageManager` 指定 pnpm 11.25.0；CI 使用 Node.js 24。

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

runner 會建立隔離 PostgreSQL／Redis、套用 migration、執行 Auth lifecycle 測試，最後移除測試 containers 與 volumes。`pnpm lint` 帶有自動修正，會修改原始碼。前端 Playwright 目前只有 scaffold，尚未覆蓋完整 Auth flow。

本次文件更新未重新執行 build／tests；既有執行紀錄與測試缺口見 [進度](docs/progress.md)及[測試策略](docs/testing-strategy.md)。

## 文件入口

- [文件索引](docs/README.md)
- [目前 HTTP API](docs/http-api.md)
- [Workspace 邀請與通知](docs/workspace-invitation-notification.md)
- [資料庫 Schema](docs/database-schema.md)
- [Session 架構](docs/session-architecture.md)
- [Socket.IO 學習路線](docs/socketio/00-kanban-roadmap.md)
