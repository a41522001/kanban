# Production VM 初始化 Runbook

最後更新：2026-10-06。依第一台 VM（e2-micro、asia-east1、Ubuntu 26.04）實際操作整理。新建 production VM 時依序執行本文件；部署架構與 CD 流程見[部署現況](deployment-plan.md#0-目前實作現況cicd-mvp)。

本文件不得放入真實密碼、Token 或私鑰。

## 1. VM 上的目錄與資源

```text
/app/                         擁有者為部署帳號，部署不需 sudo
├── compose.prod.yml          CD 以 scp 傳入，與 repo 同步
├── compose.yml               CD 以 cp 從 compose.prod.yml 複製，docker compose 預設讀取此檔
├── .env                      CD 寫入 IMAGE_TAG=<commit SHA>，只供 compose 變數替換
└── backend/
    └── .env.prod             手動建立，chmod 600；注入 backend／worker／postgres 容器
```

| Docker 資源 | 名稱 | 內容 |
| --- | --- | --- |
| Volume | `kanban-prod_kanban-postgres` | PostgreSQL 資料 |
| Volume | `kanban-prod_kanban-redis` | Redis 資料（Session、BullMQ） |
| Network | `kanban-prod_default` | 五個容器的內部網路 |

只有 `/app/backend/.env.prod` 需要手動維護；其餘檔案由 CD 產生或覆蓋。

## 2. 建立 VM

GCP Console → Compute Engine → 建立 VM 執行個體。

| 設定 | 建議值 | 說明 |
| --- | --- | --- |
| 區域 | `asia-east1`（台灣） | 延遲最低。此區域不在 e2-micro 免費額度內 |
| 機型 | 先用 `e2-medium`（2 vCPU 共用核心、4 GB）或 `e2-small`（2 GB）；實際負載上升後再升級 `e2-standard-2`（2 vCPU、8 GB） | `e2-standard-2` 在 asia-east1 預估約 US$49.92／月（2026-10-06 GCP 建立頁面顯示）。機型可在 VM 停止後直接變更，磁碟、資料與靜態 IP 皆保留，因此依 `docker stats` 觀察到的實際用量再升級即可 |
| 作業系統 | Ubuntu LTS（前一台為 26.04） | Docker 官方 apt repository 支援 |
| 開機磁碟 | 30 GB 以上 | 每次部署會下載新 image，舊版由 `docker image prune -af` 清除 |
| 防火牆 | 勾選「允許 HTTP 流量」與「允許 HTTPS 流量」 | 未勾選時外部連不到 80／443 |
| 外部 IP | **建立時即保留靜態 IP** | 臨時 IP 在 VM 停止再啟動後會改變，連帶需要更新 Secret 與 `FRONTEND_URL` |

靜態 IP 未綁定執行中的 VM 時仍會計費；刪除 VM 時一併釋放。

## 3. 設定 SSH 金鑰

部署專用金鑰已存在於開發機 `~/.ssh/kanban_deploy`（私鑰）與 `kanban_deploy.pub`（公鑰），私鑰也存在 GitHub Secret `SSH_PRIVATE_KEY`。沿用同一組時只需重新加入公鑰。

若需重新產生（Windows PowerShell，passphrase 兩次直接 Enter）：

```powershell
ssh-keygen -t ed25519 -C "<VM 使用者名稱>" -f "$HOME\.ssh\kanban_deploy"
```

`-C` 的值會被 GCP 當作 VM 登入帳號。重新產生後需同步更新 `SSH_PRIVATE_KEY` Secret。

加入公鑰：VM 詳細資料 → 編輯 → 安全殼層金鑰 → 新增項目 → 貼上 `kanban_deploy.pub` 整行 → 儲存。

驗證：

```powershell
ssh -i "$HOME\.ssh\kanban_deploy" <VM 使用者名稱>@<靜態 IP>
```

中繼資料中的金鑰不會過期。只用 GCP 網頁 SSH 時，臨時金鑰過期後 guest agent 可能把帳號移出 `google-sudoers`，出現 `sudo: I'm sorry ... I'm afraid I can't do that`；`getent group google-sudoers` 看不到帳號時，關閉 SSH 視窗重新連線即可。

## 4. 安裝 Docker

依 [Docker 官方文件](https://docs.docker.com/engine/install/ubuntu/)：

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

加入 `docker` 群組後**必須重新登入 SSH** 才會生效。不要使用 `chmod 666 /var/run/docker.sock`。

驗證：

```bash
docker run --rm hello-world
docker compose version
```

建議同時套用系統更新：`sudo apt upgrade -y`，有 kernel 更新時 `sudo reboot`。

## 5. 建立 /app

```bash
sudo mkdir -p /app/backend
sudo chown -R $USER:$USER /app
ls -ld /app
```

`ls -ld` 應顯示擁有者為部署帳號。之後 CD 以同一帳號登入寫入 `/app`，不需 sudo。

## 6. 建立 /app/backend/.env.prod

先產生資料庫密碼。使用 hex 避免 `@`、`/`、`#` 破壞 `DATABASE_URL`：

```bash
openssl rand -hex 24
```

建立檔案：

```bash
nano /app/backend/.env.prod
chmod 600 /app/backend/.env.prod
```

範本（`<>` 連同括號替換為實際值）：

```env
NODE_ENV=production
PORT=4001
FRONTEND_URL=<https://網域，或暫用 http://靜態IP>

POSTGRES_USER=kanban
POSTGRES_PASSWORD=<openssl 產生的密碼>
POSTGRES_DB=kanban
DATABASE_URL=postgresql://kanban:<同一組密碼>@postgres:5432/kanban?schema=public

REDIS_URL=redis://redis:6379

SALT_ROUNDS=10
SESSION_EXPIRE_DAY=7
SESSION_ROTATE_MINUTE=15
MAX_DEVICE=5

EMAIL_TRANSPORT=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=<Gmail>
SMTP_PASSWORD=<Gmail 應用程式密碼>
MAIL_FROM=<Gmail>
VERIFY_MAIL_EXPIRE_MINUTE=30
RATE_LIMIT_VERIFY_EMAIL_SECONDS=60
```

| 變數 | 注意事項 |
| --- | --- |
| `PORT` | 必填 `4001`。未設定時預設 3000，Nginx 會連不到 backend |
| `FRONTEND_URL` | 瀏覽器實際開啟的網址，用於 CORS、Socket.IO origin 與驗證信連結；不可有結尾 `/` |
| `DATABASE_URL`／`REDIS_URL` | host 使用 compose service 名稱 `postgres`、`redis`，不可用 `localhost` |
| `POSTGRES_*` | 只在 postgres volume 第一次初始化時生效，之後修改不會變更資料庫密碼。第一次部署前就要決定 |
| `SMTP_PORT` | 必須 `465`。`email.service.ts` 寫死 `secure: true`，587 會 TLS 握手失敗 |
| `SMTP_PASSWORD` | Gmail 應用程式密碼，不是登入密碼 |
| 格式 | `=` 前後不可有空格，行首不可有空白，值不加 `<>` |

`.env.prod` 不進 git、不進 image，請另存於密碼管理工具，刪除 VM 前先備份。

## 7. 接上 CD

1. GitHub repo → Settings → Secrets and variables → Actions，更新 `SSH_HOST` 為新的靜態 IP；`SSH_USER` 與 VM 使用者名稱一致。
2. 若先前停用了 cd workflow：Actions → cd → 右上角「⋯」→ Enable workflow。
3. 觸發部署：push 到 `main`，或在 Actions 找到最近一次成功的 cd 執行紀錄，按 Re-run all jobs（部署同一個 commit）。

第一次部署時 backend 會在啟動前執行 `prisma migrate deploy`，於空資料庫建立全部資料表。`compose.prod.yml` 由 CD 自動傳入，不需手動複製。

## 8. 驗證

VM 上：

```bash
cd /app
docker compose ps        # 五個容器皆為 Up，postgres／redis 為 healthy
cat .env                 # IMAGE_TAG 等於本次部署的 commit SHA
docker compose images    # frontend／backend／worker 的 TAG 皆為同一個 SHA
docker compose logs backend --tail 50
docker compose logs worker --tail 50
```

外部：

| 請求 | 預期 |
| --- | --- |
| `GET /` | 200，前端頁面 |
| `GET /v1/api/user/userInfo` | 401，`Unauthenticated` envelope（代表 Nginx → backend → DB／Redis 正常） |
| `GET /socket.io/?EIO=4&transport=polling` | 200，回傳含 `sid` 的 handshake |
| 註冊新帳號 | 收到驗證信；收不到時先看垃圾郵件匣，再看 worker log |

Worker log 會印出 job 資料（含驗證 token），分享 log 前先移除 token。

## 9. 修改設定後

| 情境 | 指令 |
| --- | --- |
| 修改 `.env.prod` | `docker compose up -d --force-recreate backend worker`（`restart` 不會重新讀取 `env_file`） |
| 退回指定版本 | `echo "IMAGE_TAG=<舊 SHA>" > .env && docker compose pull && docker compose up -d`；migration 不會倒退 |

## 10. 尚未完成、建立新 VM 時一併處理

- 網域與 HTTPS：規劃使用 Cloudflare（Proxy、SSL 模式 Full (strict)、Origin Certificate 裝在 Nginx），compose 開放 443，`FRONTEND_URL` 改為 `https://`。未完成前，以 `http://IP` 存取時 secure Cookie 不會被儲存，無法登入。
- `compose.prod.yml` 加入 `restart: unless-stopped`，否則 VM 重開機後容器不會自動啟動。
- Avatar 上線前（見 [avatar 規格](avatar-processing-spec.md)）：backend 與 worker 掛載同一個 storage named volume；Nginx 新增 `location /media/`；`AVATAR_PUBLIC_BASE_URL` 會寫入資料庫，應在網域確定後才上線。

## 11. 下線 VM

1. 備份 `/app/backend/.env.prod` 到密碼管理工具。
2. GitHub Actions 停用 cd workflow，避免合併到 main 時 deploy 因 SSH 逾時失敗。
3. 刪除 VM（磁碟、volume 中的資料庫資料一併刪除）。
4. 釋放靜態 IP。

GHCR image、GitHub Secrets 與開發機上的 `kanban_deploy` 金鑰保留，重建時沿用。
