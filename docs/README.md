# Flowboard 文件索引

本目錄保存會影響多個模組的規格、設計決策與驗收條件。實作前先更新規格，完成後同步更新 progress。

## 目前優先順序

1. [Session 架構與輪轉](session-architecture.md)：完成 revoke／logout 一致性與整合測試。
2. [測試策略](testing-strategy.md)：修復 backend E2E 設定並覆蓋 Session Lua。
3. [Frontend Auth vertical slice](frontend-auth-plan.md)。
4. [Socket.IO Session handshake](socketio-auth-plan.md)。
5. [Kanban domain 與一致性](kanban-domain-plan.md)。
6. [API contract 與錯誤處理](api-contract-plan.md)。
7. [Logging 計畫](logging-plan.md)。
8. [安全檢查表](security-checklist.md)與[部署計畫](deployment-plan.md)。

## 既有路線

- [學習進度](progress.md)
- [整體學習路線](roadmap.md)
- [Socket.IO Kanban roadmap](socketio/00-kanban-roadmap.md)

## 文件更新規則

- 規格改變時，先改文件再改 contracts 與程式。
- 完成一個 milestone 後，記錄驗收指令與結果。
- 尚未決定的事項標記為 Decision pending，不在程式中默認猜測。
- 描述「目前行為」時以 contracts、Prisma schema 與執行中的 TypeScript／Lua 為準；目標設計需明確標記為尚未實作。
- 文件內不得放入真實 secret、Cookie、Token、Session ID 或 production credential。
