# Flowboard Kanban

用來練習 Socket.IO 即時協作的 Kanban 專案。重點是 session authentication、room authorization、ack、冪等、concurrency 與 reconnect recovery。

完整學習路線請看：[Socket.IO Kanban roadmap](docs/socketio/00-kanban-roadmap.md)。

## 結構

```text
kanban/
├── frontend/             # Vue 3 + Vite + Tailwind CSS + Pinia
├── backend/              # NestJS + Prisma + Redis + Socket.IO
├── packages/contracts/   # 前後端共用 TypeScript contracts
└── design/               # Flowboard 視覺稿
```

## 目前完成項目

- PostgreSQL User model 與 Prisma client。
- Redis Session：Cookie 保存 raw session ID；Redis key 使用 SHA-256 hash。
- Signup、login、userInfo、logout API。
- HttpOnly session cookie 與 Session Guard。
- Session rotation、5 裝置限制，以及最小 revoke（原子刪除請求 Session 與 ZSET member）。
- Auth lifecycle E2E：signup → login → userInfo → logout → userInfo 401；本機與 GitHub Actions 都會使用隔離 PostgreSQL／Redis 執行。
- 統一成功 response envelope：

```json
{
  "code": 1,
  "data": null,
  "message": "請求成功",
  "time": "2026-08-18T00:00:00.000Z",
  "error": null
}
```

- `AppException`、HTTP exception filter 骨架。
- Pino HTTP request log 與敏感欄位 redact。
- Swagger：`http://localhost:4001/api/docs`。
- Socket.IO 最小 typed `demo:echo`。

## 尚未完成

- 前端 Auth API 串接與登入狀態恢復。
- Socket.IO session cookie handshake。
- Board、list、card schema 與 room authorization。
- Ack、retry、idempotency、optimistic concurrency、recovery。
- Redis adapter、多節點、RabbitMQ 與 deployment。

## 本機啟動

在 `kanban` 執行：

```sh
pnpm install
docker compose up -d
pnpm dev:backend
pnpm dev:frontend
```

預設網址：

- Frontend：`http://localhost:5173`
- Backend：`http://localhost:4001`
- Swagger：`http://localhost:4001/api/docs`
- PostgreSQL：`localhost:5432`
- Redis：`localhost:6379`

Backend 需要先建立 `backend/.env`，並提供 `DATABASE_URL`、`REDIS_URL`、`FRONTEND_URL`、`SALT_ROUNDS` 等環境變數。

## Backend E2E

執行完整的 Auth lifecycle E2E：

```sh
pnpm test:backend:e2e
```

它會啟動暫存的 PostgreSQL 與 Redis、套用 migration、執行測試，最後移除 E2E containers 與 volumes。本機第一次執行前，建立 E2E 設定：

```sh
cp backend/.env.e2e.example backend/.env.e2e
```

## Session Auth 流程

```text
Login API
  → PostgreSQL 驗證 email / password
  → 建立 Redis Session
  → raw session ID 寫入 HttpOnly Cookie
  → frontend 以 credentials: 'include' 呼叫 userInfo
  → Session Guard 從 Cookie 取出 session，驗證 Redis，設定 request.userId
```
