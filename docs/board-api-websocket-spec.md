# Project Board API 與 WebSocket 規格

最後核對：2026-09-21。本文是 Board vertical slice 的目標規格；已實作端點以[目前 HTTP API](http-api.md)為準。

## 1. 邊界與命名

- 路由頁面：`/projects/:projectId`，元件：`ProjectView`。
- 資料階層：`Workspace → Project → BoardColumn → Card`。
- 不建立 `Board` model／table。Board 是 Project 的 Kanban UI／snapshot；Project 是 aggregate root。
- Project scope 由 `ProjectMember` 控制，不建立 BoardMember。
- PostgreSQL 是 Project、Column、Card 與 membership 的持久化真相；Pinia、Socket.IO room 與 Redis 都不是。
- Notification 沒有 `BOARD` resource type；看板層級通知使用 `PROJECT`，卡片通知使用 `CARD`。

## 2. 已實作狀態

- `Project.version Int @default(1)`：Project metadata optimistic concurrency。
- `Project.boardRevision BigInt @default(0)`：Column／Card domain mutation 序號。
- `BoardColumn` model 與 migration 已建立，直接以 `projectId` 關聯 Project。
- `DEFAULT_BOARD_COLUMNS` shared contract 已建立。
- 建立 Project 時，Repository nested-create 四個預設 Columns；外層既有 transaction 同時建立 OWNER ProjectMember。
- `BoardModule` 已註冊為後續實作骨架，目前沒有 snapshot／command endpoints。

目前 scoped 驗證已通過 contracts build、Backend build、Project Service／Controller 2 suites／36 tests，以及 Frontend type-check。既有隔離 E2E 只驗證到前 11 個 migrations；最新 BoardColumn migration與預設四欄持久化仍需補 integration／E2E。

## 3. 資料模型

### Project

| 欄位 | 用途 |
| --- | --- |
| `id` | Project 與 Board snapshot 的公開識別碼 |
| `version` | 保護 name／description／status 等 Project metadata |
| `boardRevision` | 每次成功的 Column／Card mutation 單調遞增；對 JS client 序列化為 string |
| `archivedAt` | Project 軟封存；封存後不可加入 room 或執行 Board command |

`version` 與 `boardRevision` 不可互換：前者偵測 Project metadata 寫入衝突，後者偵測整份 Kanban state 是否漏事件。

### BoardColumn

| 欄位 | 用途 |
| --- | --- |
| `id` | Column UUID |
| `projectId` | 直接指向 aggregate root |
| `title` | 最長 80 字元 |
| `colorKey` | 最長 30 字元的穩定視覺 key |
| `position` | 邏輯排序值，不是 px |
| `version` | Column optimistic concurrency |
| `archivedAt` | Column 軟封存 |

預設值依序為 `1024 / 2048 / 3072 / 4096`，對應準備開始、正在進行、等待檢視、已完成。查詢依 `position ASC, id ASC`；position 不設 unique。

### Card（尚未建立）

Card 直接屬於 BoardColumn，透過 Column 取得 Project scope。至少包含 `id`、`columnId`、`title`、`description`、`position`、`version`、`dueAt`、`archivedAt`、timestamps。Card 狀態由 Column 決定，不重複存 status。

## 4. 建立 Project

`POST /project` 的 transaction 邊界：

1. 驗證建立者是有效 WorkspaceMember。
2. 建立 Project。
3. 在同一 `project.create` nested write 建立四個預設 Columns。
4. 使用同一 Prisma TransactionClient 建立 OWNER ProjectMember。
5. 全部成功才 commit。

預設 Columns 是初始 snapshot，所以 `boardRevision` 保持 0。任一步失敗都不得留下半套 Project、membership 或 Columns。

## 5. Snapshot API（目標）

### `GET /project/:projectId/board`

授權：有效 ProjectMember，Project 與 Workspace 都未封存。

```ts
interface ProjectBoardSnapshot {
  project: {
    id: string;
    workspaceId: string;
    name: string;
    description: string | null;
    status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
    version: number;
  };
  currentUserRole: 'OWNER' | 'EDITOR' | 'VIEWER';
  boardRevision: string;
  columns: BoardColumnSnapshot[];
}

interface BoardColumnSnapshot {
  id: string;
  projectId: string;
  title: string;
  colorKey: string;
  position: number;
  version: number;
  cards: CardSnapshot[];
}
```

只回傳未封存 Columns／Cards，兩層都以 `position, id` 穩定排序。不存在與無權限均應使用不洩漏資源存在性的安全錯誤策略。

## 6. HTTP 與 Socket 分工

- HTTP：首次 snapshot、reconnect resync、Project metadata、成員管理、Category／Label query。
- Socket command：高頻 Column／Card mutation，例如 create、update、move、archive。
- Socket event：commit 後把 authoritative result 廣播給同 Project clients。
- Socket 斷線或 revision gap 時，以 HTTP snapshot 校正，不把 client local state 當真相。

## 7. Project room

Room name：`project:{projectId}`。Client 只傳 projectId，Server 驗證 UUID、Project archivedAt 與 ProjectMember 後自行組出 room name。

```ts
interface ProjectJoinPayload {
  projectId: string;
  lastKnownRevision?: string;
}
```

建議事件：

- client → server：`project:join`、`project:leave`
- server → client：`project:joined`、`project:resyncRequired`

進入頁面流程：

1. `GET /project/:projectId/board` 取得 snapshot。
2. 套用 snapshot 並保存 `boardRevision`。
3. `project:join({ projectId, lastKnownRevision })`。
4. Server 驗證 membership 後加入 room。
5. revision 不連續時回 `project:resyncRequired`，Client 重新取 snapshot。

離開 `ProjectView` 時主動 leave；disconnect 時由 Socket.IO 清理連線 room。reconnect 後必須重新授權與 join。

## 8. Command contract

```ts
interface CommandMeta {
  commandId: string;
  projectId: string;
}

interface UpdateColumnCommand extends CommandMeta {
  columnId: string;
  expectedVersion: number;
  title?: string;
  colorKey?: string;
}

interface MoveCardCommand extends CommandMeta {
  cardId: string;
  targetColumnId: string;
  beforeCardId?: string;
  afterCardId?: string;
  expectedVersion: number;
}
```

Client 不提交可信任的 userId 或最終 position。Server 必須重新驗證 ProjectMember role、所有 IDs 的 Project scope、相鄰參考資料與 expectedVersion。

## 9. Ack 與錯誤

```ts
type CommandAck<T> =
  | {
      ok: true;
      commandId: string;
      projectId: string;
      boardRevision: string;
      data: T;
    }
  | {
      ok: false;
      commandId: string;
      code:
        | 'VALIDATION_ERROR'
        | 'UNAUTHORIZED'
        | 'FORBIDDEN'
        | 'RESOURCE_NOT_FOUND'
        | 'VERSION_CONFLICT'
        | 'IDEMPOTENCY_KEY_REUSED'
        | 'INTERNAL_ERROR';
      message: string;
      current?: unknown;
    };
```

前端 optimistic update 必須保存 rollback 資訊。Timeout 不等於失敗；相同 command retry 必須使用相同 commandId。

## 10. Mutation transaction

每個 Column／Card command：

1. 從 Socket Session 取得 userId。
2. 查 Project／ProjectMember／目標 entity。
3. 驗證角色、scope 與 expectedVersion。
4. 寫入 entity 與必要的排序重排。
5. 原子遞增 `Project.boardRevision` 並取得新值。
6. commit。
7. 回 ack，再向 `project:{projectId}` broadcast。

transaction rollback 時不可發成功 ack 或 domain event。

## 11. Domain events

建議事件：`project.updated`、`column.created`、`column.updated`、`column.moved`、`card.created`、`card.updated`、`card.moved`、`card.archived`。

```ts
interface DomainEvent<T> {
  eventId: string;
  commandId: string;
  projectId: string;
  boardRevision: string;
  actorId: string;
  occurredAt: string;
  data: T;
}
```

Client 只接受比目前 revision 新的事件；重複事件忽略，出現 gap 則 resync。`actorId` 若會公開到瀏覽器，應遵守 public identifier 規範，不直接洩漏內部 User ID。

## 12. Idempotency（後續階段）

CommandReceipt 以 `commandId` 建立 unique constraint，至少保存 userId、projectId、eventName、payloadHash、status 與第一次 ack。相同 commandId／相同 payload 回傳原結果；同 ID／不同 payload 回 `IDEMPOTENCY_KEY_REUSED`。

第一版可以先完成 transaction、version 與 snapshot resync，再加入 receipt；但在 receipt 完成前，client 不應自動無限 retry mutation。

## 13. Presence 與 Redis（後續階段）

- Presence key scope 使用 projectId，例如 `project:{projectId}:presence`。
- Soft lock 可使用 `project:{projectId}:card-drag-lock:{cardId}` 與 TTL。
- lock value 必須包含 owner token；release 用 compare-and-delete，不能直接 DEL。
- Redis adapter 只解決跨 Socket instance 廣播，不取代 PostgreSQL transaction、authorization 或 idempotency。

## 14. 測試與驗收

### 下一步最低驗收

- [ ] 全新資料庫成功套用 12 個 migrations。
- [ ] 建立 Project 後恰有四個預設 Columns，內容與順序正確。
- [ ] OWNER membership 或 Column 建立失敗時整個 create flow rollback。
- [ ] 非 WorkspaceMember 不能建立 Project。
- [ ] snapshot 僅 ProjectMember 可讀，且只含未封存資料。

### Socket 階段驗收

- [ ] 非 ProjectMember 無法 join `project:{projectId}`。
- [ ] Viewer 無法執行 mutation。
- [ ] commit 後才 broadcast；rollback 不發事件。
- [ ] version conflict 不覆蓋新資料。
- [ ] 重複 commandId 不產生第二次副作用。
- [ ] reconnect／revision gap 能以 snapshot 收斂。

## 15. 實作順序

1. 補最新 migration deploy 與 Project 建立預設 Columns integration／E2E。
2. 定義 Board snapshot shared contracts 與 `GET /project/:projectId/board`。
3. 建立 Card／Category／Label schema 與 migration。
4. 實作 Column／Card service commands、position 與 version。
5. 實作 `project:{projectId}` room authorization。
6. 加入 typed ack、commit-after-broadcast 與 revision resync。
7. 加入 CommandReceipt、presence／soft lock；多 instance 後才導入 Redis adapter。
