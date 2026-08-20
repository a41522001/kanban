# Kanban Domain 與一致性計畫

## 1. 目標

先把 Kanban 的資料邊界、權限、排序與即時同步規則定清楚，再擴充 event handler，避免後續因併發與權限問題重寫核心流程。

## 2. 第一版 Domain

### Board

- id
- title
- ownerId
- version
- createdAt、updatedAt

### BoardMember

- boardId
- userId
- role：OWNER、EDITOR、VIEWER
- createdAt

boardId 與 userId 建立 unique constraint。

### Column

- id
- boardId
- title
- position
- version
- createdAt、updatedAt

### Card

- id
- columnId
- title
- description
- position
- version
- createdBy、assigneeId
- createdAt、updatedAt

第一版先不要同時加入標籤、附件、留言、活動紀錄等功能。先完成 Board、Column、Card 的基本生命週期和即時一致性。

## 3. 權限模型

| 動作 | Owner | Editor | Viewer |
| --- | --- | --- | --- |
| 讀取 Board | 是 | 是 | 是 |
| 修改 Board | 是 | 否 | 否 |
| 管理成員 | 是 | 否 | 否 |
| 建立／修改 Column | 是 | 是 | 否 |
| 建立／修改 Card | 是 | 是 | 否 |
| 刪除 Board | 是 | 否 | 否 |

權限檢查應放在 application/service 邊界，不只放 Controller 或 Socket Gateway。這樣 HTTP、Socket 與未來 background job 共用同一規則。

## 4. 排序策略

第一版建議使用整數 position，移動項目時在 transaction 內重排受影響區間，理由是規則直觀、容易驗證。

注意事項：

- position 由 server 計算，client 只傳目標 columnId 與目標 index。
- 同一 Column 內的 position 應有一致且可預期的排序。
- 跨 Column 移動要同時更新來源與目標區間。
- 資料量或拖曳頻率明顯增加後，再評估 fractional indexing 或 LexoRank。

## 5. Command 契約

修改資料的請求建議包含：

~~~ts
type CommandMeta = {
  commandId: string;
  expectedVersion: number;
};
~~~

- commandId：提供 idempotency，避免重連或 client retry 重複寫入。
- expectedVersion：提供 optimistic concurrency control。
- 身分由 Session 取得，不放在 command payload。

範例 command：

- CreateBoard
- RenameBoard
- AddBoardMember
- CreateColumn
- MoveColumn
- CreateCard
- UpdateCard
- MoveCard
- DeleteCard

## 6. Transaction 邊界

每個 command 應形成一個 transaction：

1. 查詢必要資源與成員權限。
2. 驗證 expectedVersion。
3. 寫入資料及調整排序。
4. 更新 aggregate version。
5. commit。
6. commit 成功後回傳 ack 並 broadcast。

transaction 失敗時不得發布成功事件。

## 7. Optimistic Concurrency

更新時把 id 與 version 都放入條件，成功後 version 加一。若受影響列數為 0，代表資源已被其他操作修改，回 VERSION_CONFLICT。

衝突時第一版採以下策略：

- Server 不自動覆蓋新資料。
- Ack 回 VERSION_CONFLICT 與目前 version。
- Client 重新取得 Board snapshot，顯示提示後讓使用者重新操作。

不要把 last-write-wins 當成預設策略，否則多人拖曳時可能靜默覆蓋資料。

## 8. Idempotency

每個 mutation command 使用 UUID commandId。Server 保存已完成 command 的結果，至少以 userId 與 commandId 建立 unique constraint。

同一 commandId 再次送達時：

- 不重複執行 mutation。
- 回傳第一次執行結果。
- 不重複 broadcast，或讓 eventId 可被 client 去重。

第一版若尚未建立完整 Command table，可先確保前端不在 timeout 後盲目 retry；但進入多人即時協作前必須補齊。

## 9. Domain Event

事件只描述已經成功發生的事：

- board.created
- board.renamed
- column.created
- column.moved
- card.created
- card.updated
- card.moved
- card.deleted

每個 event 至少包含：

- eventId
- boardId
- actorId
- aggregateId
- version
- occurredAt
- 必要且最小的更新資料

若未來要跨 process 保證 DB commit 與訊息發布一致，再導入 Outbox Pattern。單一 NestJS instance 的第一版可以 commit 後 broadcast，但文件與程式碼要保留這個邊界。

## 10. Prisma 與資料庫約束

- 所有外鍵明確設定 delete 行為，避免預設 cascade 造成誤刪。
- BoardMember 使用複合 unique constraint。
- position 查詢建立 boardId/columnId + position index。
- 常用查詢以 boardId、updatedAt、assigneeId 建立必要索引。
- Prisma migration 必須提交版本控制，production 不使用 db push。
- Service 層仍需做 authorization；資料庫約束只負責最後一道完整性保護。

## 11. 測試順序

1. Board member authorization unit tests。
2. Card move 與 position 重排 unit tests。
3. version conflict integration tests。
4. transaction rollback integration tests。
5. duplicate commandId integration tests。
6. 兩個 Socket client 的 broadcast e2e tests。
7. reconnect 後 snapshot recovery e2e tests。

## 12. 實作里程碑

### M1：Board 基礎

- [ ] Prisma schema、migration、repository。
- [ ] 建立／讀取 Board。
- [ ] BoardMember 與角色權限。

### M2：Column 與 Card

- [ ] CRUD 與 validation。
- [ ] position 排序與 transaction。
- [ ] REST 或 application service 測試。

### M3：即時協作

- [ ] typed Socket events 與 ack。
- [ ] room authorization。
- [ ] commit 後 broadcast。

### M4：一致性

- [ ] version conflict。
- [ ] idempotent command。
- [ ] reconnect snapshot recovery。

