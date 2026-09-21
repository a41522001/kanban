# 學習路線

## 目標

不是再做一次普通聊天室，而是理解即時系統的連線、協定、可靠性、安全邊界與狀態同步。

技術主線：

```text
Vue 3 browser WebSocket
→ Express + ws
→ Socket.IO
→ Redis Session Cookie、room、ack、冪等與 Kanban 狀態同步
```

每週約投入 5 小時，不設定完成期限。

## 學習規則

每章固定使用：

1. 本章只引入一個核心概念。
2. 先給規格，不先給完整答案。
3. 學習者自行實作。
4. Codex review lifecycle、資料流與失敗情境。
5. 通過驗收後更新 `progress.md`。
6. 把錯誤理解與修正原因寫進學習紀錄。

## Phase 1：Native WebSocket

### 已完成

1. Connection lifecycle。
2. JSON message protocol。
3. Broadcast 與 server push。
4. Presence / online count。
5. Application-level heartbeat。
6. Basic reconnect。
7. Runtime validation。
8. Heartbeat timeout。

### Native 收尾

9. Exponential backoff、jitter、max retries。
10. Backpressure 概念與小實驗。

專案已先進入 Socket.IO／Flowboard 主線；Native 第 9、10 章保留為獨立收尾，不再阻塞 Kanban vertical slices。

## Phase 2：Socket.IO 協作 Kanban

目前進度（2026-09-21）：步驟 1、2 已完成第一版，並已補上 Workspace room 的 membership authorization、into／leave lifecycle 與成員變更 invalidation；Project create、list、members、member candidates、addMember、notification detail 與每位成員自己的 pin／unpin 已串接前後端。Project 頁統一使用 `ProjectView` 與 `/projects/:projectId`，其中 Board 仍是本機假資料。Project scoped unit tests、Frontend type-check 與可從空資料庫套用 11 個 migrations 的隔離 E2E 已通過；pin endpoint 尚缺 HTTP E2E。下一個 domain 可交付點才是 Board／Column／Card read model 與 Board room authorization，再進入 Socket command、ack、idempotency 與 concurrency。Project 負向授權／rollback／真實併行、Session handshake rotation Cookie、Workspace room reconnect 與真實 lifecycle tests 仍需補完。

題材：多人協作 Kanban。

核心順序：

1. 用 Socket.IO 重建最小連線與 typed events。
2. HttpOnly Session Cookie handshake authentication；HTTP 與 Socket.IO 共用 Redis Session。
3. Board room 與 server-side authorization。
4. Card create / move / edit 的 acknowledgement。
5. Timeout、retry、command ID 與 idempotency。
6. PostgreSQL transaction 與 optimistic concurrency。
7. Reconnect、state recovery 與 snapshot resync。
8. Multi-user integration / Playwright tests。

詳細路線見 [Socket.IO Kanban roadmap](socketio/00-kanban-roadmap.md)。

## 延後處理

以下不阻塞進入 Socket.IO：

- 完整 backpressure queue framework。
- Redis adapter 與多節點。
- Nginx、部署與壓測。
- 多人即時遊戲 tick / prediction。

等 Kanban 的單節點可靠性完成，再獨立安排 scaling 階段。
