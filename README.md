# Flowboard Kanban

多人協作 Kanban 練習專案，主線是 Redis Session、權限、Socket.IO、併發與重連恢復。

**目前做到哪裡、還缺什麼，見 [進度](docs/progress.md)。** 本文只說明專案結構與如何在本機啟動。

## 專案結構

| 路徑 | 用途 |
| --- | --- |
| `frontend/` | Vue 3、TypeScript、Vite、Pinia、Tailwind CSS、Reka UI、vue-i18n |
| `backend/` | NestJS、Prisma、PostgreSQL、Redis、Socket.IO、Pino、Swagger |
| `packages/contracts/` | 共用 HTTP／Socket 型別與 runtime enum，輸出 ESM／CJS |
| `docs/` | 規格、現行行為與進度，分類見 [文件索引](docs/README.md) |
| `design/`、`figma-plugin/` | 視覺稿與 Figma Development Plugin |
| `scripts/` | 隔離 Backend E2E 執行工具 |
| `bruno/` | Bruno API 測試 collection |

## 本機啟動

需要 Node.js 24.13.0、pnpm 與可用的 Docker。專案以 `.nvmrc` 固定 Node 版本；若使用 nvm，進入專案後執行 `nvm use`。根目錄 `packageManager` 指定 pnpm 11.25.0，CI 也讀取 `.nvmrc`。

以下指令在專案根目錄執行。首次建立設定檔，已存在時請直接編輯，避免覆蓋本機設定：

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

設定 `backend/.env` 的 PostgreSQL 帳密、`DATABASE_URL`、`REDIS_URL` 與 `SEQ_FIRSTRUN_ADMINPASSWORD`；Docker Compose 與後端使用的資料庫帳密必須一致。`frontend/.env` 沿用範例即可（`VITE_API_URL=http://localhost:4001/v1/api`、`VITE_SOCKET_URL=http://localhost:4001`）。

要把 log 送進 Seq 時，在 `backend/.env` 加上下面這行。`.env.example` 裡是註解，直接複製不會生效；不設定時 log 只印在終端機。

```dotenv
SEQ_URL=http://localhost:5341
```

```sh
pnpm install
pnpm --filter @kanban/contracts build
docker compose up -d
pnpm --filter backend exec prisma generate
pnpm --filter backend exec prisma migrate deploy
```

PostgreSQL／Redis 就緒後，分別在三個 terminal 啟動：

```sh
pnpm dev:backend
pnpm dev:worker
pnpm dev:frontend
```

`dev:worker` 負責寄驗證信與產生頭像的 sm／lg；沒有啟動時，這兩件事的 job 會停在 Redis 排隊。

- 前端：`http://localhost:5173/`，未登入導向 `/login`，已登入導向 `/workspace`。
- 後端：`http://localhost:4001`，REST API 全域前綴為 `/v1/api`（例如 `http://localhost:4001/v1/api/user/userInfo`）。
- 頭像圖片（只在 `NODE_ENV=development` 提供）：`http://localhost:4001/media/...`。
- Swagger：`http://localhost:4001/api/docs`。
- Seq：`http://localhost:5341`。
- PostgreSQL／Redis：`localhost:5432`／`localhost:6379`。
- Compose 啟動 PostgreSQL、Redis 與 Seq，不包含前後端應用程式。
- API 測試：用 Bruno 開啟 `bruno/` collection，選擇 `Local` 環境後先執行 `Auth/Login`。

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

## 文件入口

- [進度](docs/progress.md)
- [文件索引](docs/README.md)
- [目前 HTTP API](docs/reference/http-api.md)
- [資料庫 Schema](docs/reference/database-schema.md)
- [Board 與 Card 規格](docs/features/board.md)
