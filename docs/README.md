# Flowboard 文件索引

本目錄保存會影響多個模組的規格、設計決策與驗收條件。實作前先更新規格，完成後同步更新 progress。

## 目前優先順序

1. [SVG 設計前功能盤點](feature-readiness.md)：審查目前功能缺口、API 能力與畫面範圍。
2. [目前 HTTP API](http-api.md)、[API contract](api-contract-plan.md)：Auth 已加入驗證／重寄、部分註冊成功與登入限制；Board 現行端點與未完成項目已分開標示。
3. [驗證信前端設計提案](email-verification-ui-plan.md)：後端流程已具備，前端兩頁與錯誤分流待實作；審查後再 SVG → Figma → Vue。
4. [Board API 與 WebSocket](board-api-websocket-spec.md)：先補 GET /board/:projectId 授權，再完成 snapshot、持久化拖曳、Card 與協作。
5. [Workspace 邀請與通知](workspace-invitation-notification.md)：取消、分頁、併發與 reconnect resync。
6. [Session 架構](session-architecture.md)、[測試策略](testing-strategy.md)、[Logging](logging-plan.md)、[安全](security-checklist.md)與[部署](deployment-plan.md)：依各文件未完成項目推進。

## 現行實作入口

- [目前 HTTP API](http-api.md)
- [Workspace 邀請與通知](workspace-invitation-notification.md)
- [Frontend Auth vertical slice](frontend-auth-plan.md)
- [驗證信 Queue／Worker 規格](email-verification-worker-spec.md)
- [驗證信 UI／SVG 待審查提案](email-verification-ui-plan.md)
- [設計前功能盤點](feature-readiness.md)

最後靜態核對：2026-09-27。本輪文件更新未執行測試。上一輪 Auth 實作驗收為後端 169 tests 通過、5 skipped，E2E 4 suites／13 tests 通過及前後端型別檢查通過；歷史驗收不代表所有待辦已完成，詳見 progress。

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
