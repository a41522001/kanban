# Deployment 與維運計畫

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

- NODE_ENV、PORT
- DATABASE_URL
- REDIS_URL 或 Redis host/port/password
- FRONTEND_URL、CORS origins
- Session Cookie name、secret、TTL、Secure、SameSite、Domain
- Log level

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
- 建立 Session secret、DB password、Redis password 的 rotation runbook。
- 若 secret 洩漏，需能快速撤銷 Session 並重新部署。

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

