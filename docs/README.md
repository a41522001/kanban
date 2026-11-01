# Flowboard 文件索引

本目錄保存會影響多個模組的規格、設計決策與驗收條件。實作前先更新規格，完成後同步更新進度。

## 從哪裡開始

- **目前做到哪裡**：[進度](progress.md)（唯一記錄整體狀態的地方）
- **某個功能的規則與步驟**：`features/` 底下對應的文件
- **API 與資料表現在長什麼樣子**：`reference/`
- **API 測試**：專案根目錄的 `bruno/`（用 Bruno 開啟 collection）

## 分類

| 資料夾 | 內容 | 文件 |
| --- | --- | --- |
| （根目錄） | 整體狀態 | [進度](progress.md) |
| `features/` | 功能規格：規則與該功能自己的實作步驟 | [Auth 前端](features/auth-frontend.md)、[驗證信 Worker](features/email-verification-worker.md)、[驗證信 UI](features/email-verification-ui.md)、[Workspace 邀請與通知](features/workspace-invitation-notification.md)、[頭像](features/avatar.md)、[Board 與 Card](features/board.md) |
| `reference/` | 現在的行為，以程式碼為準 | [HTTP API](reference/http-api.md)、[API contract](reference/api-contract.md)、[資料庫 Schema](reference/database-schema.md) |
| `architecture/` | 跨功能的設計 | [Session](architecture/session.md)、[Socket.IO 驗證](architecture/socketio-auth.md)、[Logging](architecture/logging.md) |
| `operations/` | 部署與維運 | [部署現況與 CI/CD](operations/deployment.md)、[VM 初始化 Runbook](operations/vm-setup-runbook.md) |
| `guides/` | 開發規則 | [測試策略](guides/testing.md)、[安全檢查清單](guides/security-checklist.md)、[前端 UI 守則](guides/frontend-design.md)、[Figma 工作流程](guides/figma-workflow.md) |

## 文件更新規則

- 規格改變時，先改文件再改 contracts 與程式。
- **狀態只寫在兩個地方**：整體進度寫在 `progress.md`；功能自己的實作步驟寫在該功能的 `features/` 文件。其他文件只寫規則與現行行為，不寫「目前做到哪裡」。
- 尚未決定的事項標記為 Decision pending，不在程式中默認猜測。
- 描述「目前行為」時以 contracts、Prisma schema 與執行中的 TypeScript／Lua 為準；目標設計需明確標記為尚未實作。
- 被新文件取代時，先把仍有用的內容併入新文件，再刪除舊文件；需要時從 git 歷史查看，不另外保留封存資料夾。
- 文件內不得放入真實 secret、Cookie、Token、Session ID 或 production credential。
