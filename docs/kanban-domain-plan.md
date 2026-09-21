# Kanban Domain 與一致性計畫

最後核對：2026-09-21。本文區分「已實作」與「目標設計」；現行端點以[目前 HTTP API](http-api.md)為準。

## 1. 核心決策

1. 資訊階層是 `Workspace → Project → BoardColumn → Card`。
2. 不建立 `Board` model／table。產品畫面中的 Board 是 Project 的 Kanban read model，Project 本身就是 Board aggregate root。
3. 路由使用 `/projects/:projectId`，頁面名稱是 `ProjectView`；頁面內呈現 Board UI。
4. Project 權限統一由 `ProjectMember` 控制，不建立 BoardMember。
5. Category 與 Label 在 Project 範圍共用；Card 最多一個 Category，可有多個 Labels。
6. Board 層級通知以 `NotificationResourceType.PROJECT` 指向 Project；不保留 `BOARD` resource type。

## 2. 目前實作邊界

User、Workspace、WorkspaceMember、WorkspaceInvitation、Notification、Project、ProjectMember 與 BoardColumn 已有 Prisma schema。Project 已有 create／list／members／memberCandidates／addMember／notification detail／pin API 與前端第一版。

`BoardColumn` migration 已建立；建立 Project 時，Project Repository 以 nested write 同時建立四個預設 Columns，Project Service 的既有 transaction 再建立 OWNER ProjectMember，因此 Project、預設 Columns 與 OWNER membership 共用同一 transaction。`Project.boardRevision` 初始為 0，因為預設 Columns 屬於初始 snapshot，不是建立後的協作 mutation。

尚未完成：Board snapshot API、Column commands、Card／Category／Label schema、Project room、Socket commands、idempotency、recovery，以及直接驗證預設四欄持久化的 integration／E2E。既有 11 個 migrations 的隔離 E2E 已通過；最新第 12 個 BoardColumn migration 尚未重跑完整隔離 E2E。

## 3. 第一版 Domain

### Project

- `id`、`workspaceId`、`name`、`description`
- `status`：`ACTIVE`、`ON_HOLD`、`COMPLETED`
- `createdById`、`archivedAt`、`createdAt`、`updatedAt`
- `version`：Project metadata 的 optimistic concurrency；預設 1
- `boardRevision`：Column／Card domain mutation 的單調遞增序號；預設 0

`status` 與 `archivedAt` 是不同概念。`version` 保護 Project 名稱、描述、狀態等 metadata；`boardRevision` 用來判斷整份 Kanban snapshot 是否落後，對 JavaScript client 一律序列化成字串。

建立 Project 時必須在同一 transaction：

1. 驗證建立者是有效 WorkspaceMember。
2. 建立 Project。
3. 以 nested write 建立四個預設 BoardColumns。
4. 建立建立者的 ProjectMember，角色為 `OWNER`。

### ProjectMember

- `id`、`projectId`、`userId`
- `role`：`OWNER`、`EDITOR`、`VIEWER`
- `joinedAt`
- `pinnedAt`：目前成員自己的 Project 置頂時間

`@@unique([projectId, userId])` 防止重複 membership。ProjectMember 必須同時是 Project 所屬 Workspace 的 WorkspaceMember；此跨 table 規則由 application service 驗證。

### BoardColumn

- `id`、`projectId`
- `title`、`colorKey`
- `position`：邏輯排序值，不是 px
- `version`：Column optimistic concurrency；預設 1
- `archivedAt`、`createdAt`、`updatedAt`

預設 Columns：

| title | colorKey | position |
| --- | --- | ---: |
| 準備開始 | `ready` | 1024 |
| 正在進行 | `active` | 2048 |
| 等待檢視 | `review` | 3072 |
| 已完成 | `done` | 4096 |

索引使用 `projectId + archivedAt + position + id`。`position` 不設 unique；`id` 是穩定 tie-break。

### Card（目標設計，尚未建立）

- `id`、`columnId`、`categoryId?`
- `title`、`description`
- `position`、`version`
- `dueAt?`、`createdById`
- `archivedAt`、`createdAt`、`updatedAt`

Card 狀態由所在 BoardColumn 決定，不重複保存 `status`。透過 Column 可追溯其 Project。

### CardCategory／CardLabel（目標設計）

兩者直接帶 `projectId`，在 Project 範圍內共用。`projectId + normalizedName` 建立 unique constraint。Category／Label 必須與 Card 所在 Column 屬於同一 Project，由 application service 驗證。

## 4. 權限模型

| 動作 | Owner | Editor | Viewer |
| --- | --- | --- | --- |
| 讀取 Project／Board snapshot | 是 | 是 | 是 |
| 修改 Project metadata／status | 是 | 否 | 否 |
| 管理 ProjectMember | 是 | 否 | 否 |
| 建立／修改／移動 BoardColumn | 是 | 是 | 否 |
| 建立／修改／移動 Card | 是 | 是 | 否 |
| 建立 Category／Label | 是 | 是 | 否 |
| 封存 Project | 是 | 否 | 否 |

HTTP、Socket 與 background worker 必須共用 application/service policy。任何 client 傳入的 Project／Column／Card ID 都要重新驗證 scope，不能只依賴 room membership。

## 5. 排序策略

第一版使用整數 position 與 1024 間隔。Client 傳 `beforeId`／`afterId` 等相鄰關係，Server 驗證同一 scope 後計算 position；兩值間沒有空間時，在 transaction 內重新編排該 Project 的 Columns 或該 Column 的 Cards。

- Column index：`projectId + archivedAt + position + id`。
- Card index：`columnId + archivedAt + position + id`。
- position 不建立 unique constraint，避免重排過程暫時撞值。
- 資料量或拖曳頻率增加後，再評估 fractional indexing 或 LexoRank。

## 6. Command、Transaction 與一致性

```ts
type CommandMeta = {
  commandId: string;
  projectId: string;
};
```

更新既有 entity 時另帶 `expectedVersion`。身分只從 Session 取得，不接受 payload 中的 userId。

每個 mutation 的 transaction：

1. 取得 Session userId。
2. 查詢 ProjectMember 與目標資源。
3. 驗證角色、資源階層及 expectedVersion。
4. 寫入 entity、排序或 archive 狀態。
5. 將 `Project.boardRevision` 原子加一。
6. commit 後才 ack 與 broadcast。

version update 應把 entity id 與 expectedVersion 都放在條件中；受影響列數為 0 時回 `VERSION_CONFLICT`，不可靜默採 last-write-wins。Client 可套用 Server 回傳的 authoritative entity，必要時重新取得 snapshot。

## 7. Idempotency 與 Domain Event（目標設計）

每個 mutation command 使用 UUID `commandId`。可靠性階段加入 CommandReceipt，以 commandId unique，保存 userId、projectId、eventName、payloadHash 與第一次 ack。相同 ID／相同內容回第一次結果；相同 ID／不同內容回 idempotency key reused error。

事件至少包含：`eventId`、`commandId`、`projectId`、`boardRevision`、`actorId`、`occurredAt` 與 authoritative entity data。單一 NestJS instance 可先在 commit 後直接 emit；recovery 階段再加入事件保存，message queue 階段才加入 Outbox／RabbitMQ。

## 8. Project room 與 Snapshot（目標設計）

- Room：`project:{projectId}`，只能由 Server 組合。
- Join：驗證 UUID、未封存 Project 與 ProjectMember 後加入。
- Snapshot：`GET /project/:projectId/board`。
- Snapshot 至少回 Project metadata、`boardRevision` 字串、依 `position,id` 排序的 Columns，以及各 Column 的 Cards。
- reconnect 或 revision gap 時重新取得 snapshot；Socket 不是持久化真相。

## 9. 測試順序

1. CreateProject transaction：Project、OWNER membership、四個預設 Columns 同時成功／rollback。
2. 從空資料庫套用包含 BoardColumn 在內的 12 個 migrations。
3. Board snapshot authorization 與排序 integration tests。
4. Column／Card scope、move、重排與 version conflict tests。
5. duplicate commandId integration tests。
6. 兩個真實 Socket clients 的 broadcast／reconnect／resync E2E。

## 10. 實作里程碑

### M1：Project 與初始看板

- [x] Project／ProjectMember schema、Repository、核心 HTTP API 與 pin。
- [x] Project `version`／`boardRevision` 與 BoardColumn schema／migration。
- [x] 建立 Project 時 nested-create 四個預設 Columns。
- [ ] 補 migration deploy 與預設 Columns transaction integration／E2E。
- [ ] Project detail、角色調整與移除成員。

### M2：Board read model 與 Card metadata

- [ ] `GET /project/:projectId/board` snapshot。
- [ ] Card／CardCategory／CardLabel schema 與 migration。
- [ ] Column／Card CRUD、archive 與 position transaction。

### M3：即時協作

- [ ] typed Socket events／ack 與 `project:{projectId}` room authorization。
- [ ] 每個 mutation 重新驗證 ProjectMember role。
- [ ] commit 後 broadcast。

### M4：一致性與恢復

- [ ] version conflict。
- [ ] CommandReceipt idempotency。
- [ ] revision gap 與 reconnect snapshot recovery。

### M5：多 instance 與非同步工作

- [ ] Presence／soft lock TTL。
- [ ] Socket.IO Redis adapter 與多 instance 測試。
- [ ] Transactional Outbox、RabbitMQ retry／DLQ／consumer idempotency。
