# Flowboard 文件索引

本目錄保存會影響多個模組的規格、設計決策與驗收條件。實作前先更新規格，完成後同步更新 progress。

## 目前優先順序

1. [目前 HTTP API](http-api.md)與[測試策略](testing-strategy.md)：補 Project pin 的 HTTP E2E 與 endpoint-specific Swagger metadata。
2. [Kanban domain 與一致性](kanban-domain-plan.md)：Project 已確立為 Board aggregate root，BoardColumn schema／migration 與預設四欄已完成；下一步補最新 migration E2E、snapshot 與 Card schema。
3. [Board API 與 WebSocket](board-api-websocket-spec.md)：以 `project:{projectId}` room 實作 authorization，再導入 command、ack、idempotency、concurrency 與 recovery。
4. [Workspace 邀請與通知](workspace-invitation-notification.md)：補取消、query 分頁、expiration job／rollback／併發測試、room reconnect 與漏收同步。
5. [Session 架構與輪轉](session-architecture.md)：補 SessionService、Lua 與真實 Redis integration tests，並收斂 handshake rotation／完整 revoke 策略。
6. [API contract 與錯誤處理](api-contract-plan.md)：補共用 Swagger response schema 與 Project detail／角色調整／移除成員 endpoints。
7. [Logging 計畫](logging-plan.md)。
8. [安全檢查表](security-checklist.md)與[部署計畫](deployment-plan.md)。

## 現行實作入口

- [目前 HTTP API](http-api.md)
- [Workspace 邀請與通知](workspace-invitation-notification.md)
- [Frontend Auth vertical slice](frontend-auth-plan.md)

最後核對：2026-09-21。Project 前後端第一版已加入每位 ProjectMember 的置頂偏好；前端 Project 頁已統一為 `ProjectView` 與 `/projects/:projectId`。Project 是 Board aggregate root，不建立 Board table；BoardColumn migration、預設四欄 nested create 與 shared contract 已加入。contracts／Backend build、Project 36 tests 與 Frontend type-check 通過；最新第 12 個 migration 尚未納入隔離 E2E。完整執行紀錄以 progress 為準。

## 既有路線

- [學習進度](progress.md)
- [整體學習路線](roadmap.md)
- [Socket.IO Kanban roadmap](socketio/00-kanban-roadmap.md)
- [Frontend UI 實作守則](frontend-design-guidelines.md)
- [Figma UI 設計稿工作流程](figma-ui-design-workflow.md)

## 文件更新規則

- 規格改變時，先改文件再改 contracts 與程式。
- 完成一個 milestone 後，記錄驗收指令與結果。
- 尚未決定的事項標記為 Decision pending，不在程式中默認猜測。
- 描述「目前行為」時以 contracts、Prisma schema 與執行中的 TypeScript／Lua 為準；目標設計需明確標記為尚未實作。
- 文件內不得放入真實 secret、Cookie、Token、Session ID 或 production credential。
