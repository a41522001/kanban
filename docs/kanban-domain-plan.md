# Kanban Domain 與一致性計畫

## 1. 目標與已確認決策

先把 Kanban 的資料邊界、權限、排序與即時同步規則定清楚，再擴充 event handler，避免後續因產品階層、併發與權限問題重寫核心流程。

已確認的產品決策：

1. 資訊階層為 `Workspace → Project → Board → BoardColumn → Card`。
2. Workspace 同時支援個人與團隊；不建立 `PERSONAL`／`TEAM` 類型。只有一位成員時就是個人使用，加入其他成員後就是團隊使用。
3. 同一個 Project 的所有 Boards 共用 ProjectMember 與角色權限，不建立 BoardMember。
4. Category 與 Label 在 Project 範圍內共用。
5. Card 最多一個 Category，可以有多個 Labels；兩者都屬於第一版持久化範圍。

## 2. 第一版 Domain

### User

沿用既有 Auth domain：

- id
- email
- displayName
- passwordHash
- avatarUrl
- createdAt、updatedAt

### Workspace

- id
- name
- createdById
- archivedAt
- createdAt、updatedAt

建立 Workspace 時，必須在同一 transaction 建立建立者的 WorkspaceMember，角色為 `OWNER`。

### WorkspaceMember

- workspaceId
- userId
- role：`OWNER`、`MEMBER`
- joinedAt

`workspaceId + userId` 使用 composite primary key。WorkspaceMember 代表使用者能進入工作區；實際能否進入 Project 仍由 ProjectMember 決定。

### Project

- id
- workspaceId
- name
- description
- status：`ACTIVE`、`ON_HOLD`、`COMPLETED`
- createdById
- archivedAt
- createdAt、updatedAt

`status` 表示 Project 生命週期；`archivedAt` 表示是否從一般列表隱藏，兩者不可合併成同一欄位。Project 完成不會自動修改 Boards、Columns 或 Cards。

建立 Project 時，必須在同一 transaction：

1. 驗證建立者是 WorkspaceMember。
2. 建立 Project。
3. 建立建立者的 ProjectMember，角色為 `OWNER`。
4. 建立主要 Board。
5. 建立四個預設 BoardColumns。

### ProjectMember

- projectId
- userId
- role：`OWNER`、`EDITOR`、`VIEWER`
- joinedAt

`projectId + userId` 使用 composite primary key。ProjectMember 必須同時是 Project 所屬 Workspace 的 WorkspaceMember；這個跨 table 條件由 application service 在 transaction 內驗證。

Board room join、Board snapshot、Column/Card command 都透過 `Board → Project → ProjectMember` 取得權限，不建立重複的 BoardMember。

### Board

- id
- projectId
- name
- description
- isPrimary
- position
- version
- revision
- createdById
- archivedAt
- createdAt、updatedAt

同一個 Project 同時只能有一個未封存的 primary Board。PostgreSQL 使用 partial unique index 保護 `projectId + isPrimary = true + archivedAt IS NULL`。

專案目前使用 Prisma 7.9。可選擇啟用 `partialIndexes` preview feature，或在 migration 內手寫 `CREATE UNIQUE INDEX ... WHERE "isPrimary" = true AND "archivedAt" IS NULL`。不可改用一般的 `@@unique([projectId, isPrimary, archivedAt])`，因為 PostgreSQL 對 `NULL` 的唯一性語意無法保證只存在一個未封存 primary Board。參考 [Prisma partial indexes 官方文件](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes#configuring-partial-indexes-with-where)。

`version` 用於 Board metadata optimistic concurrency；`revision` 是 Board domain mutation 的單調遞增序號，傳給 JavaScript client 時必須序列化成字串。

### BoardColumn

- id
- boardId
- title
- colorKey
- position
- version
- createdAt、updatedAt

預設 Columns：

| Title    | colorKey | position |
| -------- | -------- | -------- |
| 準備開始 | `ready`  | 1024     |
| 正在進行 | `active` | 2048     |
| 等待檢視 | `review` | 3072     |
| 已完成   | `done`   | 4096     |

### CardCategory

- id
- projectId
- name
- normalizedName
- colorKey
- createdById
- createdAt、updatedAt

`projectId + normalizedName` 建立 unique constraint。`colorKey` 保存穩定 key，例如 `mint`，不保存 hex、CSS variable 或 Tailwind class。後端透過 shared contract whitelist 驗證目前支援的 14 個 keys。

### CardLabel

- id
- projectId
- name
- normalizedName
- createdById
- createdAt、updatedAt

`projectId + normalizedName` 建立 unique constraint。`normalizedName` 由 Server 對輸入做 trim 與一致化後產生，用來避免同一 Project 出現只有大小寫或空白差異的重複 Label。

### Card

- id
- columnId
- categoryId，nullable
- title
- description
- position
- version
- dueAt
- createdById
- archivedAt
- createdAt、updatedAt

Card 的狀態由所屬 BoardColumn 決定，不額外保存 `status`。Category 必須和 Card 所在 Board 屬於同一個 Project；由 application service 驗證。

### CardLabelAssignment

- cardId
- labelId
- assignedAt

`cardId + labelId` 使用 composite primary key。Label 必須和 Card 所在 Board 屬於同一個 Project。Card 或 Label 被實際刪除時可以 cascade 刪除 assignment；核心 Workspace、Project、Board、Card 不使用無條件 cascade hard delete。

## 3. 權限模型

### Workspace 權限

| 動作 | Owner | Member |
| --- | --- | --- |
| 讀取 Workspace | 是 | 是 |
| 修改 Workspace | 是 | 否 |
| 邀請／移除 WorkspaceMember | 是 | 否 |
| 建立 Project | 是 | 是 |
| 封存 Workspace | 是 | 否 |

### Project 與 Board 權限

| 動作 | Owner | Editor | Viewer |
| --- | --- | --- | --- |
| 讀取 Project／Board | 是 | 是 | 是 |
| 修改 Project metadata／status | 是 | 否 | 否 |
| 管理 ProjectMember | 是 | 否 | 否 |
| 建立／修改 Board | 是 | 否 | 否 |
| 建立／修改 BoardColumn | 是 | 是 | 否 |
| 建立／修改 Card | 是 | 是 | 否 |
| 建立 Category／Label | 是 | 是 | 否 |
| 封存 Project／Board | 是 | 否 | 否 |

權限檢查應放在 application/service 邊界，不只放 Controller 或 Socket Gateway。HTTP、Socket 與未來 background worker 必須共用同一組 policy。

## 4. 排序策略

第一版使用整數 position 與固定間隔：初始值為 `1024`、`2048`、`3072`。插入兩筆之間時由 Server 計算中間值；沒有空間時，在 transaction 內重新編排該 Board 或 BoardColumn。

注意事項：

- Client 不可直接提交可信任的 position。
- Card／Column move command 傳 `beforeId`、`afterId` 或等價相鄰關係。
- Server 必須確認參考 entity 位於目標 Board／Column。
- Board 使用 `projectId + position` index；Column 使用 `boardId + position` index；Card 使用 `columnId + position` index。這些排序 index 不建立 unique constraint，避免 transaction 重排時暫時撞值。
- 資料量或拖曳頻率明顯增加後，再評估 fractional indexing 或 LexoRank。

## 5. Command 契約

修改 Board domain 的 Socket command 使用：

```ts
type CommandMeta = {
  commandId: string;
  boardId: string;
};
```

更新既有 entity 的 command 另外攜帶 `expectedVersion`。

- `commandId`：提供 idempotency，避免重連或 client retry 重複寫入。
- `expectedVersion`：提供 optimistic concurrency control。
- 身分由 Session 取得，不放在 command payload。

HTTP commands：

- CreateWorkspace
- CreateProject
- UpdateProjectStatus
- AddWorkspaceMember
- AddProjectMember
- CreateCardCategory
- CreateCardLabel

Socket commands：

- UpdateBoard
- CreateColumn
- UpdateColumn
- MoveColumn
- CreateCard
- UpdateCard
- MoveCard
- ArchiveCard

## 6. Transaction 邊界

每個 mutation 應形成一個清楚的 transaction：

1. 從 Session 取得 userId。
2. 查詢必要資源與 WorkspaceMember／ProjectMember。
3. 驗證角色、資源階層和 expectedVersion。
4. 寫入資料及調整排序。
5. Board domain mutation 更新 Board revision。
6. commit。
7. commit 成功後回傳 HTTP response 或 Socket ack，並 broadcast domain event。

transaction 失敗時不得發布成功事件。

## 7. Optimistic Concurrency

更新時把 entity id 與 version 都放入條件，成功後 version 加一。若受影響列數為 0，代表資源已被其他操作修改，回 `VERSION_CONFLICT`。

衝突時第一版採以下策略：

- Server 不自動覆蓋新資料。
- Ack 回 `VERSION_CONFLICT` 與目前 authoritative entity/version。
- Client 校正或重新取得 Board snapshot，顯示提示後讓使用者重新操作。

不要把 last-write-wins 當成預設策略，否則多人拖曳時可能靜默覆蓋資料。

## 8. Idempotency

每個 mutation command 使用 UUID commandId。進入可靠性階段後，Server 使用 CommandReceipt 保存已完成 command 的結果，至少以 commandId 建立 unique constraint，並保存 userId、boardId、eventName、payloadHash 與第一次 ack data。

同一 commandId 再次送達時：

- 不重複執行 mutation。
- 相同 user、event 與 payload 回傳第一次結果。
- 相同 ID 搭配不同內容回 idempotency key reused error。

## 9. Domain Event 與 Message Queue

Board room domain events 只描述已 commit 的事實：

- board.updated
- column.created
- column.updated
- column.moved
- card.created
- card.updated
- card.moved
- card.archived

每個 event 至少包含 eventId、commandId、boardId、boardRevision、actorId、occurredAt 與必要的 authoritative entity data。

第一版單一 NestJS instance 可以 commit 後直接 Socket.IO broadcast。進入 recovery 階段後加入 BoardEvent；進入 Message Queue 階段後加入 OutboxMessage，由 publisher 將 committed event 發送到 RabbitMQ，再由 Activity worker／其他 consumer 處理。不要誤稱一般 Socket.IO emit 或 RabbitMQ 為 exactly-once delivery。

## 10. Prisma 與資料庫約束

- 所有外鍵明確設定 delete 行為。
- WorkspaceMember、ProjectMember、CardLabelAssignment 使用 composite primary key。
- Project 內 Category／Label 使用 normalizedName unique constraint。
- CardCategory.colorKey 使用 varchar + shared contract whitelist，不使用 PostgreSQL enum。
- ProjectStatus、WorkspaceRole、ProjectRole 是穩定 domain values，可使用 Prisma/PostgreSQL enum。
- 常用查詢建立 `workspaceId + archivedAt`、`workspaceId + status`、`projectId + position`、`boardId + position`、`columnId + position` index。
- position 不建立 unique constraint。
- Prisma migration 必須提交版本控制，production 不使用 db push。
- Service 層仍需做 authorization 與跨 table scope 驗證；資料庫約束只負責最後一道完整性保護。

## 11. 測試順序

1. WorkspaceMember／ProjectMember authorization unit tests。
2. CreateWorkspace 與 CreateProject transaction integration tests。
3. Category／Label project scope tests。
4. Board snapshot authorization integration tests。
5. Card move 與 position 重排 unit tests。
6. version conflict integration tests。
7. transaction rollback integration tests。
8. duplicate commandId integration tests。
9. 兩個 Socket client 的 broadcast e2e tests。
10. reconnect 後 snapshot recovery e2e tests。

## 12. 實作里程碑

### M1：Workspace 與 Project 基礎

- [ ] Prisma schema、migration、repository。
- [ ] 建立／讀取 Workspace。
- [ ] 建立 Project transaction：ProjectMember OWNER、主要 Board、四個預設 Columns。
- [ ] WorkspaceMember 與 ProjectMember 權限。

### M2：Board read model 與 Card metadata

- [ ] 取得 Project 與 Board snapshot。
- [ ] CardCategory／CardLabel 建立與查詢。
- [ ] Card／Column CRUD validation 與 position transaction。

### M3：即時協作

- [ ] typed Socket events 與 ack。
- [ ] Board room join 時透過 ProjectMember authorization。
- [ ] 每個 mutation 重新驗證 ProjectMember role。
- [ ] commit 後 broadcast。

### M4：一致性與恢復

- [ ] version conflict。
- [ ] CommandReceipt idempotency。
- [ ] BoardEvent 與 reconnect snapshot recovery。

### M5：Redis 與 Message Queue

- [ ] Presence 與 soft lock TTL。
- [ ] Socket.IO Redis adapter 與多 instance 測試。
- [ ] Transactional Outbox。
- [ ] RabbitMQ activity consumer、retry、DLQ 與 consumer idempotency。
