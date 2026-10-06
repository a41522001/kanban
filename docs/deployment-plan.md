# Deployment 與維運計畫

## 0. 目前實作現況（CI/CD MVP）

最後核對：2026-10-06。本節描述已實作並部署的行為；第 1 節以後為目標設計，兩者差異列於本節最後。第一台 VM（e2-micro）規劃刪除並以較高規格重建，新 VM 依 [VM 初始化 Runbook](vm-setup-runbook.md) 建立。

### 架構

單一 GCP Compute Engine VM（e2-micro、Ubuntu 26.04、asia-east1）以 Docker Compose 執行五個容器：

~~~text
Internet
   |
frontend (Nginx) :80
   |-- /            -> Vue 靜態檔（SPA fallback 到 index.html）
   |-- /v1/api/     -> backend:4001（保留 /v1/api 前綴）
   |-- /socket.io/  -> backend:4001（WebSocket Upgrade）

Compose 預設網路（未對外開 port）
   |-- backend   (NestJS API；啟動前先執行 migration)
   |-- worker    (BullMQ 寄信 Worker；與 backend 共用 image)
   |-- postgres  (postgres:18.1，volume kanban-postgres)
   |-- redis     (redis:8.8-alpine，volume kanban-redis)
~~~

- Backend 以 `app.setGlobalPrefix('v1/api')` 提供 REST 路由，`GET /health` 被排除於前綴之外，但目前沒有實作 health controller。Socket.IO 不受 global prefix 影響，固定使用 `/socket.io/`。
- 前端 build 時注入 `VITE_API_URL=/v1/api`、`VITE_SOCKET_URL=/`（Dockerfile `ARG` 預設值）。兩者皆為同源相對路徑，VM IP 或網域變更時不需重新 build。

### 相關檔案

| 檔案 | 用途 |
| --- | --- |
| `backend/Dockerfile` | Multi-stage；builder 執行 `pnpm install --frozen-lockfile`、`prisma generate`、Nest build；runner 帶入 `dist`、`prisma/`、`prisma.config.ts` 與完整 `node_modules`。`CMD` 先執行 `npx --no prisma migrate deploy`，成功後 `exec node dist/src/main.js` |
| `frontend/Dockerfile` | Multi-stage；builder 執行 type-check 與 Vite build，runner 為 `nginx:1.31.6-alpine` |
| `frontend/nginx.conf` | 靜態檔、`/v1/api/` 與 `/socket.io/` 反向代理 |
| `compose.prod.yml` | Production compose；frontend／backend／worker 使用 `ghcr.io/a41522001/kanban-*:${IMAGE_TAG:-latest}` |
| `.dockerignore` | 排除 `node_modules`、`dist`、`.env*`、`*.tsbuildinfo`、Prisma 產生檔與 `.git` |
| `.github/workflows/ci.yml` | push 到 `dev`、`feature/*` 時執行 Backend E2E 與 unit tests；提供 `workflow_call` 給 CD 呼叫 |
| `.github/workflows/cd.yml` | push 到 `main` 時：呼叫 ci.yml → build／push image → SSH 部署 |

Runner 階段不使用 `pnpm run`：在只含 backend 的 image 內執行 `pnpm run` 會觸發 pnpm 對整個 workspace 重新 install（2026-10-05 實測），因此 `CMD` 直接呼叫 `npx --no prisma` 與 `node`。`--no` 確保找不到本機 Prisma 時直接失敗，不會從 npm 下載其他版本。

### CD 流程（cd.yml）

1. `ci`：以 reusable workflow 呼叫 ci.yml。
2. `build`：登入 GHCR（`GITHUB_TOKEN`，workflow 權限 `packages: write`），build frontend 與 backend image，各推送 `latest` 與 `${{ github.sha }}` 兩個 tag。
3. `deploy`：以 `appleboy/scp-action` 將 `compose.prod.yml` 傳到 VM 的 `/app`，再以 `appleboy/ssh-action` 執行：
   - `echo "IMAGE_TAG=${{ github.sha }}" > .env`：compose 從 `/app/.env` 讀取 image tag，手動執行 `docker compose` 時也使用同一版本。
   - `cp compose.prod.yml compose.yml`：使用 cp 而非 mv，只重跑 deploy job 時仍可成功。
   - `docker compose pull`、`docker compose up -d`。
   - `docker image prune -af`：移除未被容器使用的舊版 image，避免 VM 磁碟被版本累積占滿。
   - script 開頭 `set -e`，任一步失敗即中止並讓 workflow 顯示失敗。

GHCR 上的 `kanban-frontend`、`kanban-backend` 因連結到 public repo 而為 public；VM 不需 `docker login`。Image 不含 `.env.prod`。

### GitHub Secrets 與 VM 設定

| 項目 | 內容 |
| --- | --- |
| Secrets | `SSH_HOST`（VM 外部 IP）、`SSH_USER`、`SSH_PRIVATE_KEY`（部署專用 ed25519 金鑰，無 passphrase） |
| VM SSH 公鑰 | 加在 VM 中繼資料，不會過期 |
| `/app` | 由 `sudo mkdir` 建立並 `chown` 給部署帳號，部署不需 sudo |
| `/app/backend/.env.prod` | 手動建立、`chmod 600`，不進版控與 image。DB／Redis host 使用 service 名稱 `postgres`、`redis`；`PORT=4001` 必填（未設定時預設 3000，Nginx 會連不到） |
| `/app/.env` | 由 deploy 寫入 `IMAGE_TAG`，僅供 compose 變數替換，與容器環境變數無關 |
| Docker | 官方 apt repository 安裝；部署帳號加入 `docker` 群組 |

注意事項：

- VM 目前使用**臨時外部 IP**。VM 停止再啟動後 IP 會改變，需同步更新 `SSH_HOST` Secret 與 `.env.prod` 的 `FRONTEND_URL`。
- `POSTGRES_USER`／`POSTGRES_PASSWORD` 只在 postgres volume 第一次初始化時生效，之後修改 `.env.prod` 不會變更資料庫密碼。
- `email.service.ts` 寫死 `secure: true`，`SMTP_PORT` 必須使用 465；使用 587 會因 TLS 握手失敗而寄不出信。
- 修改 `.env.prod` 後需 `docker compose up -d --force-recreate backend worker`；`restart` 不會重新讀取 `env_file`。

### 驗收紀錄

- 2026-10-05：本機 build 兩個 image 成功（backend 1.04 GB、frontend 96 MB）。不給環境變數執行 API 與 Worker 入口時，皆執行到 zod env 驗證才停止，確認路徑別名、Prisma client 與 contracts 可正常載入；`nginx -t` 通過；前端 bundle 含 `v1/api`、不含 `localhost:4001`。以臨時 PostgreSQL 執行 `npx --no prisma migrate deploy`，14 個 migrations 全部套用、建立 9 張資料表。
- 2026-10-06：cd.yml 於 main 執行，部署到 VM。外部檢查 `/` 回 200、`/v1/api/user/userInfo` 回 401 與 `Unauthenticated` envelope、`/socket.io/?EIO=4&transport=polling` 回 200 handshake；GHCR 兩個 image 匿名 pull 回 200。使用者回報修正 SMTP 設定後，production 註冊驗證信可正常收信。
- Image SHA tag 與 `IMAGE_TAG` 部署流程已實作；尚未記錄 VM 上 `cat /app/.env` 與 `docker compose images` 的核對結果。

### 已知限制與尚未完成

- **登入無法使用**：production Cookie 為 `secure: true`、`sameSite: 'none'`，以 `http://IP` 瀏覽時瀏覽器不會儲存 Cookie。需完成網域與 HTTPS（規劃：Cloudflare 購買網域，Proxy 搭配 Full (strict) 與 Origin Certificate），並將 `FRONTEND_URL` 改為 `https://` 網域。
- 尚未改用靜態 IP；尚未設定 `restart: unless-stopped`，VM 重開機後容器不會自動啟動。
- 退版只回復程式碼，不回復 migration。
- 與下方目標設計的差異：backend 以 root 執行且 runtime 含 devDependencies（Prisma CLI 為 devDependency，migration 需要）；migration 在 backend 容器啟動時執行，非獨立 release job；無 health check、smoke test、vulnerability scan 與 deployment concurrency；Nginx 未傳遞 `X-Forwarded-*` 等 header，NestJS 未設定 trust proxy；未設定 log rotation 與資料庫備份。
- scp／ssh action 未設定 `fingerprint`，尚未固定 VM 主機身分；第三方 action 以版本號釘選，未釘選 commit SHA。

## 1. 目標架構

第一版採單一 Linux VPS 與 Docker Compose，降低維運複雜度：

~~~text
Internet
   |
Nginx :443
   |-- /           -> Frontend static files
   |-- /api        -> NestJS :4001
   |-- /socket.io  -> NestJS :4001 (WebSocket upgrade)

Internal Docker network
   |-- PostgreSQL
   |-- Redis
~~~

只有 Nginx 對外開放 80/443。Backend、PostgreSQL 與 Redis 不映射到公網介面。

## 2. 環境分類

- local：開發者電腦，允許 Docker Compose 與 hot reload。
- test：單元／整合／e2e 測試，使用獨立 PostgreSQL、Redis。
- production：VPS，只有 production dependencies 與正式 secrets。

每個 app 提供 .env.example，但不提交真正的 .env。

需要明確管理的設定：

- `NODE_ENV`、`PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `FRONTEND_URL`
- `SALT_ROUNDS`
- `SESSION_EXPIRE_DAY`、`SESSION_ROTATE_MINUTE`、`MAX_DEVICE`

目前 Cookie name、20 秒 Grace、SameSite 與 Domain 不是環境變數；若部署需要調整，應先集中成 typed config，不要在不同 Controller／Guard 各自新增常數。Session 採 opaque random ID + Redis record，不需要簽章用 Session secret。

目前 `REDIS_URL` schema 只接受 `redis://`。若 production Redis 要使用 TLS 的 `rediss://`，必須先修改 env schema 與連線設定並完成部署測試。

啟動時使用 schema 驗證環境變數，缺少必要值就直接停止。

## 3. Docker Image

### Backend

- 使用 multi-stage build。
- 安裝依賴時使用 pnpm frozen lockfile。
- build 階段產生 Prisma Client 與 NestJS dist。
- runtime 只保留 production dependencies、dist、Prisma 必要檔案。
- 使用 non-root user。
- 固定 Node major/minor image tag，避免 latest。

### Frontend

- build 階段產生靜態檔案。
- 由 Nginx 提供檔案，或由獨立靜態服務部署。
- API base URL 優先使用同源 /api，降低 CORS 與 Cookie 複雜度。

### Image 驗證

- image 不含 .env、node_modules cache、測試檔與 Git metadata。
- 在 CI 啟動 container 並執行 health check。
- 定期掃描 OS package 與 npm dependency 漏洞。

## 4. Database Migration

Production 部署使用 prisma migrate deploy，不使用 prisma db push。

部署順序：

1. 備份資料庫。
2. 拉取或建置指定 commit 的 image。
3. 由單一 release job 執行 migration。
4. Migration 成功後才更新 Backend container。
5. 執行 smoke test。

破壞性 schema 變更採 expand-and-contract：先新增可相容欄位、發布新程式、搬移資料，最後一個版本才移除舊欄位。

2026-09-21 隔離 E2E 已確認包含 `add_project_board_structure` 與 `rename_board_column_color_keys` 在內的 13 個 migrations 可從空 PostgreSQL 依序套用。前者加入 `projects.version`／`board_revision`、建立 `board_columns` 並移除 `NotificationResourceType.BOARD`；後者將舊 colorKey data tokens 安全轉為中性色票名稱。未來若開始保留 production data，移除 enum value 或新增 required 欄位前仍須驗證現存資料並採 forward-only migration／expand-and-contract，不能以清庫取代 migration 設計。

## 5. Health Check

建議提供：

- GET /health/live：process 存活即可回 200，不查外部服務。
- GET /health/ready：檢查 PostgreSQL 與 Redis 是否可用。

Docker healthcheck 使用 ready endpoint。Health response 不回傳 connection string 或內部錯誤細節。

## 6. Nginx

必要設定：

- TLS termination 與 HTTP 到 HTTPS redirect。
- /api reverse proxy 到 Backend 4001。
- /socket.io 支援 Upgrade 與 Connection headers。
- 傳遞 X-Forwarded-For、X-Forwarded-Proto、Host、X-Request-ID。
- 設定合理的 request body limit、proxy timeout 與 WebSocket idle timeout。
- Static asset 使用 cache header，index.html 不做長期 immutable cache。
- Security headers 經過測試後啟用。

NestJS 必須正確設定 trust proxy，否則 Secure Cookie、client IP 與 rate limit 可能判斷錯誤。

## 7. GitHub Actions Pipeline

Pull Request：

1. pnpm install --frozen-lockfile
2. lint
3. typecheck
4. unit tests
5. integration tests
6. build

Main branch 或 tag：

1. 重跑品質檢查。
2. 建置並標記 immutable image tag，例如 Git SHA。
3. 執行 vulnerability scan。
4. Push image 到 registry。
5. 部署到 VPS。
6. 執行 migration release step。
7. 等待 readiness。
8. 執行 API、登入、Socket 連線 smoke tests。

Deployment concurrency 設為 1，避免兩次 migration 或部署同時執行。

## 8. Secrets

- GitHub Actions 使用 environment secrets。
- VPS 的 secrets 放在限制權限的 env file 或 secret manager。
- 不把 secrets 放進 compose.yaml、Dockerfile、image build args 或 CI log。
- 建立 DB password、Redis credential 與其他 production secrets 的 rotation runbook。
- Raw Session ID 洩漏時需能快速撤銷單一裝置、單一使用者或全部 Sessions；目前 revoke 能力尚未完成，公開部署前必須補齊。

## 9. Logging 與監控

第一階段：

- Container 輸出 structured JSON 到 stdout/stderr。
- Docker 設定 log rotation，避免吃滿磁碟。
- 監控 uptime、CPU、memory、disk、container restart、5xx rate。
- PostgreSQL backup 與 TLS renewal 失敗必須告警。

第二階段：

- 導入 Loki/Grafana 或其他集中式 log 平台。
- 收集 request latency、DB latency、Redis latency、Socket connection count。
- 設定 error rate、p95 latency、登入異常與磁碟空間告警。

詳細事件欄位遵循 logging-plan.md。

## 10. Backup 與 Disaster Recovery

### PostgreSQL

- 每日自動備份，保留至少數個可用世代。
- 備份儲存在 VPS 之外的位置並加密。
- 每月至少執行一次 restore drill。
- 文件記錄 RPO 與 RTO；第一版可先以可接受的日備份損失量訂定。

### Redis

Session 可視為可重建資料。Redis 遺失時允許所有使用者重新登入，優先確保不會因恢復舊 Session 產生安全問題。

## 11. Rollback

- 每次部署保留上一個 immutable image tag。
- 程式碼 rollback 必須與 schema 相容。
- Migration 預設 forward-fix，不依賴自動向下 migration。
- Smoke test 失敗時停止導流或回復上一版 image。
- 若 deployment 造成資料問題，先停止寫入，再依 runbook 評估 restore 或修復 migration。

## 12. 上線 Checklist

- [ ] Domain、DNS、TLS 自動續期完成。
- [ ] Production env validation 通過。
- [ ] PostgreSQL、Redis 未暴露公網。
- [ ] Cookie、CORS、CSRF 與 trust proxy 驗證完成。
- [ ] Migration 在備份資料的 staging 環境演練。
- [ ] Unit、integration、e2e、build 全部通過。
- [ ] HTTP 與 Socket.IO smoke tests 通過。
- [ ] Backup 成功且 restore drill 通過。
- [ ] Log rotation、health check、uptime 與 disk alert 完成。
- [ ] Rollback 步驟由另一個終端實際演練。
