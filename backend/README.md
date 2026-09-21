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

Build／start／test 的 pre scripts 會先建置共用 contracts。Production entry 為 `node dist/src/main.js`；目前 Compose 不包含 backend deployment。

## API 與限制

預設 HTTP port 4001；Swagger 位於 `/api/docs`。API 沒有全域 `/api` 前綴。Workspace／Notification／userInfo 使用 SessionGuard；logout 無 Guard，會嘗試撤銷傳入 Cookie 並在 finally 清除 Cookie。

- [現行 HTTP API](../docs/http-api.md)
- [邀請與通知 transaction、併發限制](../docs/workspace-invitation-notification.md)
- [Session 架構](../docs/session-architecture.md)
- [測試範圍與未完成項目](../docs/testing-strategy.md)

文件最後核對：2026-09-21。2026-09-20 的完整 Backend baseline 為 19 suites／114 tests 與既有 coverage；2026-09-21 Project Service／Controller 2 suites／36 tests、BoardColumn DTO 6 tests、contracts／Backend build 與隔離 E2E 4 suites／9 tests 通過，13 個 migrations 可從空資料庫套用。Project create E2E 已經過含 BoardColumn 的 nested write，但仍需補預設四欄內容／順序的直接 assertion 與 rollback test。Pin endpoint 亦尚缺 HTTP E2E 與 endpoint-specific Swagger response metadata。
