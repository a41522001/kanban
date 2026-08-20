# Flowboard 文件索引

本目錄保存會影響多個模組的規格、設計決策與驗收條件。實作前先更新規格，完成後同步更新 progress。

## 目前優先順序

1. [API contract 與錯誤處理](api-contract-plan.md)
2. [Logging 計畫](logging-plan.md)
3. [Frontend Auth vertical slice](frontend-auth-plan.md)
4. [測試策略](testing-strategy.md)
5. [Socket.IO Session handshake](socketio-auth-plan.md)
6. [Kanban domain 與一致性](kanban-domain-plan.md)
7. [安全檢查表](security-checklist.md)
8. [部署計畫](deployment-plan.md)

## 既有路線

- [學習進度](progress.md)
- [整體學習路線](roadmap.md)
- [Socket.IO Kanban roadmap](socketio/00-kanban-roadmap.md)

## 文件更新規則

- 規格改變時，先改文件再改 contracts 與程式。
- 完成一個 milestone 後，記錄驗收指令與結果。
- 尚未決定的事項標記為 Decision pending，不在程式中默認猜測。
- 文件內不得放入真實 secret、Cookie、Token、Session ID 或 production credential。

