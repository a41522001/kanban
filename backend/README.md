# Flowboard Backend

NestJS + Prisma／PostgreSQL + Redis + Socket.IO。以下指令都從 monorepo 根目錄執行，完整環境設定見[根 README](../README.md)。

## 模組

- `auth`／`user`：註冊、密碼驗證、登入與 public user。
- `session`：Cookie Session 驗證、輪轉與撤銷；Redis Repository／Lua 負責原子操作。
- `workspaces`：建立 Workspace 與 Owner membership、列表、成員授權查詢，以及提供 membership 查詢給其他 domain service。
- `workspaceInvitation`：發送、接受與拒絕邀請，查詢 PENDING、條件式狀態更新與邀請 HTTP Controller；Owner 取消邀請尚未實作。
- `notification`：public read model、未讀數與內部建立通知。
- `socket`：掛在 HTTP server 的 Socket.IO service；以 HttpOnly Session Cookie 驗證 handshake、將 userId 寫入 `socket.data`，管理 user room 與 Workspace room，並提供 transaction commit 後的 `notification:created`／`workspace:memberChanged` 推播。
- `project`：已註冊於 AppModule；提供建立 Project、Project list、Project members、member candidates、addMember、member-added notification detail 與目前使用者的 Project 置頂／取消置頂 endpoints。建立 Project 與 OWNER membership、加入成員與通知都使用 transaction；`pinnedAt` 儲存在 ProjectMember，屬於每位使用者自己的列表偏好。
- `board`：已註冊於 AppModule 的後續功能骨架。Project 本身是 Board aggregate root，不建立 Board table；目前 `BoardColumn` schema／migration 與建立 Project 時的四個預設 Columns 已完成，snapshot／Card／Socket commands 尚未實作。
- `common`：ValidationPipe、AppException、Filter、response interceptor 與 Cookie 工具。

主要分層為 Controller → Service → Repository。邀請流程由 `WorkspaceInvitationController → WorkspaceInvitationService` 協調；Invitation Service 單向依賴 WorkspacesService 取得 membership 資訊，並使用同一 Prisma TransactionClient 寫入 Invitation 與 Notification。WorkspacesService 不再依賴 WorkspaceInvitationService。

建立 Project 的預設 Columns 是 Project aggregate invariant，因此 `ProjectModule` 不依賴 `BoardModule`；`ProjectRepository` 直接以 Prisma nested write 建立 `boardColumns`。未來 `BoardModule` 若需要 membership／Project metadata，應抽取可共用的 Project access policy 或單向依賴 Project 的公開 service，避免 ProjectModule ↔ BoardModule 循環依賴。

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

Build／start／test 的 pre scripts 會先建置共用 contracts。Production entry 為 `node dist/src/main.js`，worker 為 `node dist/src/worker/main.js`；正式環境以 `compose.prod.yml` 部署，見 [部署](../docs/operations/deployment.md)。

## API 與限制

預設 HTTP port 4001；REST API 全域前綴為 `/v1/api`（Swagger 不在前綴下，位於 `/api/docs`）。Workspace／Notification／userInfo 使用 SessionGuard；logout 無 Guard，會嘗試撤銷傳入 Cookie 並在 finally 清除 Cookie。

- [現行 HTTP API](../docs/reference/http-api.md)
- [邀請與通知 transaction、併發限制](../docs/features/workspace-invitation-notification.md)
- [Session 架構](../docs/architecture/session.md)
- [測試策略與執行方式](../docs/guides/testing.md)
- [目前進度與已知缺口](../docs/progress.md)

