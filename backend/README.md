# Flowboard Backend

NestJS + Prisma／PostgreSQL + Redis + Socket.IO。以下指令都從 monorepo 根目錄執行，完整環境設定見[根 README](../README.md)。

## 模組

- `auth`／`user`：註冊、密碼驗證、登入與 public user。
- `session`：Cookie Session 驗證、輪轉與撤銷；Redis Repository／Lua 負責原子操作。
- `workspaces`：建立 Workspace 與 Owner membership、列表、成員授權查詢與發送邀請。
- `workspaceInvitation`：建立邀請、查詢 PENDING、條件式標記過期；尚無接受／拒絕 Controller。
- `notification`：public read model、未讀數與內部建立通知。
- `socket`：掛在 HTTP server 的 Socket.IO echo；尚未接 Session handshake。
- `common`：ValidationPipe、AppException、Filter、response interceptor 與 Cookie 工具。

主要分層為 Controller → Service → Repository。跨模組邀請流程由 WorkspacesService 協調，使用同一 Prisma TransactionClient 寫入 Invitation 與 Notification。

## 指令

```sh
pnpm --filter backend exec prisma generate
pnpm --filter backend exec prisma migrate deploy
pnpm dev:backend
pnpm debug:backend
pnpm --filter backend build
pnpm test:backend
pnpm test:backend:cov
pnpm test:backend:e2e
```

先依根 README 啟動資料庫並建立 env。開發新 schema 時另產生可審閱的 migration；上述 `migrate deploy` 只套用既有 migration。Prisma config 依 `E2E_ENV=true` 選擇 `.env.e2e`，其餘使用 `.env`。

Build／start／test 的 pre scripts 會先建置共用 contracts。Production entry 為 `node dist/src/main.js`；目前 Compose 不包含 backend deployment。

## API 與限制

預設 HTTP port 4001；Swagger 位於 `/api/docs`。API 沒有全域 `/api` 前綴。Workspace／Notification／userInfo 使用 SessionGuard；logout 無 Guard，會嘗試撤銷傳入 Cookie 並在 finally 清除 Cookie。

- [現行 HTTP API](../docs/http-api.md)
- [邀請與通知 transaction、併發限制](../docs/workspace-invitation-notification.md)
- [Session 架構](../docs/session-architecture.md)
- [測試範圍與未完成項目](../docs/testing-strategy.md)

文件最後靜態核對：2026-09-08；不代表本次已執行測試。
