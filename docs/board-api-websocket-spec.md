# Flowboard Board API 與 Socket.IO Event 規格

## 文件狀態

- 狀態：設計草案。
- 適用範圍：單一 NestJS instance、PostgreSQL、Redis Session、Vue 3 client。
- 目標：先完成單節點下可靠的多人 Kanban，再考慮 Redis adapter、多節點與 RabbitMQ。
- 已存在的 Auth API、HTTP response envelope 與 Session Cookie 機制維持不變。

目前只有 Workspace 基礎模型與建立／列表／成員查詢已開始實作；Project、Board 與下列 Socket commands 仍是目標規格。現有 `GET /workspaces/:workspaceId/members` 尚未檢查呼叫者的 Workspace membership，實作後續功能前必須先補上 authorization。

這份文件描述預期契約，不代表所有功能必須一次完成。建議依照「實作階段」逐步交付，每一階段都應可獨立驗收。

## 1. 核心決策

### 1.1 HTTP 與 Socket.IO 的責任

| 類型                         | 使用方式                | 原因                                    |
| ---------------------------- | ----------------------- | --------------------------------------- |
| Session Auth                 | HTTP                    | 瀏覽器透過 HttpOnly Cookie 保存 Session |
| Workspace／Project CRUD      | HTTP                    | 低頻結構操作，不需要 Board room         |
| Workspace／Project 成員管理  | HTTP                    | 低頻管理操作，適合 request/response     |
| Category／Label 建立與查詢   | HTTP                    | Project scope metadata，不屬於單一 Board command |
| Board snapshot               | HTTP                    | 初始載入與完整 resync                   |
| Column/Card 異動             | Socket.IO command + ack | 需要即時廣播、冪等與 concurrency 控制   |
| Presence                     | Socket.IO               | 僅代表目前連線狀態                      |

同一個 Column/Card 寫入操作不要同時提供 REST 與 Socket.IO 兩條主要路徑。例如建立卡片只使用 `card:create`，不另外提供 `POST /cards`。這可以避免兩套 validation、broadcast、idempotency 與錯誤語意。

### 1.2 命名

- Database model 使用 `BoardColumn`，避免 `List` 與一般陣列概念混淆。
- REST path 使用複數名詞，例如 `/workspaces`、`/projects`、`/members`。
- Client command 使用動詞原形，例如 `card:create`。
- Server domain event 使用完成式，例如 `card:created`。
- Room name 只能由 Server 產生，格式為 `board:{boardId}`。
- Client payload 不傳 `userId`、`actorId` 或 room name；Server 從 Session 與資源關聯取得。

### 1.3 Authoritative state

PostgreSQL 是 Workspace、Project、Board、Column、Card 與 membership 的最終資料來源。Pinia optimistic state、Socket.IO room 與 Redis 都不是持久化真相。

每次成功 command 都應回傳或廣播 Server 產生的 authoritative entity，Client 不應假設自己的 optimistic 結果一定是最終結果。

## 2. MVP 範圍

### 2.1 第一版包含

- 建立／列出 Workspace；建立者自動成為 WorkspaceMember `OWNER`。
- 建立／列出 Project；建立者自動成為 ProjectMember `OWNER`。
- 建立 Project 時，在同一 transaction 產生主要 Board 與四個預設 Columns。
- WorkspaceMember 的 `OWNER`、`MEMBER` 權限。
- ProjectMember 的 `OWNER`、`EDITOR`、`VIEWER` 權限；Project 下所有 Boards 共用。
- 取得單一 Board snapshot。
- Project scope 的 CardCategory 與 CardLabel。
- 加入與離開 Board room。
- 建立、修改、移動與封存 Card。
- 建立、修改與移動 Column。
- command acknowledgement。
- command ID 與 idempotency。
- Card optimistic concurrency。
- 斷線後重新加入 room，必要時重新取得 snapshot。

### 2.2 延後功能

- Checklist。
- Comment。
- Attachment。
- Card assignee。
- Email invitation workflow。
- Board 個別 membership／ProjectMember 權限覆寫。
- 自訂 Workspace／Project role。
- Notification center。
- Redis adapter 與多個 Socket.IO instance。
- RabbitMQ。
- 完整 event history UI。
- Board template 與自訂 Column 顏色。

## 3. Domain model

### 3.1 建議 Prisma models

以下只表達欄位與關係，實際 Prisma 語法可在實作 schema 時再確認。

#### Workspace

| 欄位          | 型別                | 說明          |
| ------------- | ------------------- | ------------- |
| `id`          | UUID                | Workspace ID  |
| `name`        | varchar(100)        | Workspace 名稱|
| `createdById` | UUID                | 建立者        |
| `archivedAt`  | timestamp, nullable | 封存時間      |
| `createdAt`   | timestamp           | 建立時間      |
| `updatedAt`   | timestamp           | 最後修改時間  |

Workspace 不保存 `PERSONAL`／`TEAM` 類型；只有一位成員時是個人使用，加入其他成員後就是團隊使用。

#### WorkspaceMember

| 欄位          | 型別      | 說明              |
| ------------- | --------- | ----------------- |
| `id`          | UUID      | Membership ID     |
| `workspaceId` | UUID      | Workspace ID      |
| `userId`      | UUID      | User ID           |
| `role`        | enum      | `OWNER`、`MEMBER` |
| `joinedAt`    | timestamp | 加入時間          |

目前 Prisma schema 使用 `id` 作 primary key，並以 `(workspaceId, userId)` unique constraint 防止重複 membership。建立 Workspace 時，建立者自動成為 `OWNER`。

#### Project

| 欄位          | 型別                   | 說明                             |
| ------------- | ---------------------- | -------------------------------- |
| `id`          | UUID                   | Project ID                       |
| `workspaceId` | UUID                   | 所屬 Workspace                   |
| `name`        | varchar(100)           | Project 名稱                     |
| `description` | varchar(500), nullable | 簡短描述                         |
| `status`      | enum                   | `ACTIVE`、`ON_HOLD`、`COMPLETED` |
| `createdById` | UUID                   | 建立者                           |
| `archivedAt`  | timestamp, nullable    | 封存時間                         |
| `createdAt`   | timestamp              | 建立時間                         |
| `updatedAt`   | timestamp              | 最後修改時間                     |

Project status 與 archivedAt 是不同概念；完成 Project 不會自動移動或修改任何 Card。

#### ProjectMember

| 欄位        | 型別      | 說明                        |
| ----------- | --------- | --------------------------- |
| `projectId` | UUID      | Project ID                  |
| `userId`    | UUID      | User ID                     |
| `role`      | enum      | `OWNER`、`EDITOR`、`VIEWER` |
| `joinedAt`  | timestamp | 加入時間                    |

Primary key 使用 `(projectId, userId)`。ProjectMember 必須同時是 Project 所屬 Workspace 的 WorkspaceMember。Board 不建立獨立 membership；所有 Boards 透過 ProjectMember 繼承權限。

#### Board

| 欄位          | 型別                   | 說明                                  |
| ------------- | ---------------------- | ------------------------------------- |
| `id`          | UUID                   | Board ID                              |
| `projectId`   | UUID                   | 所屬 Project                          |
| `name`        | varchar(100)           | Board 名稱                            |
| `description` | varchar(500), nullable | 簡短描述                              |
| `isPrimary`   | boolean                | 是否為 Project 主要 Board             |
| `position`    | integer                | 同一 Project 內排序位置               |
| `createdById` | UUID                   | 建立者                                |
| `version`     | integer                | Board metadata optimistic concurrency |
| `revision`    | bigint                 | 每次 Board domain mutation 遞增       |
| `archivedAt`  | timestamp, nullable    | 封存時間                              |
| `createdAt`   | timestamp              | 建立時間                              |
| `updatedAt`   | timestamp              | 最後修改時間                          |

同一個 Project 同時只能有一個未封存的 primary Board。使用 PostgreSQL partial unique index 保護 `projectId + isPrimary = true + archivedAt IS NULL`。`revision` 對 JavaScript client 一律序列化成字串。

#### BoardColumn

| 欄位        | 型別        | 說明                                               |
| ----------- | ----------- | -------------------------------------------------- |
| `id`        | UUID        | Column ID                                          |
| `boardId`   | UUID        | 所屬 Board                                         |
| `title`     | varchar(80) | Column 標題                                        |
| `colorKey`  | varchar(30) | UI token，例如 `ready`、`active`、`review`、`done` |
| `position`  | integer     | 同一 Board 內排序位置                              |
| `version`   | integer     | Column concurrency version                         |
| `createdAt` | timestamp   | 建立時間                                           |
| `updatedAt` | timestamp   | 修改時間                                           |

#### CardCategory

| 欄位             | 型別        | 說明                         |
| ---------------- | ----------- | ---------------------------- |
| `id`             | UUID        | Category ID                  |
| `projectId`      | UUID        | 所屬 Project                 |
| `name`           | varchar(50) | 顯示名稱                     |
| `normalizedName` | varchar(50) | Server 正規化名稱            |
| `colorKey`       | varchar(20) | 前端色票 key，不保存實際色碼 |
| `createdById`    | UUID        | 建立者                       |
| `createdAt`      | timestamp   | 建立時間                     |
| `updatedAt`      | timestamp   | 修改時間                     |

`(projectId, normalizedName)` 建立 unique constraint。colorKey 使用 shared contract whitelist 驗證，不使用 PostgreSQL enum。

#### CardLabel

| 欄位             | 型別        | 說明              |
| ---------------- | ----------- | ----------------- |
| `id`             | UUID        | Label ID          |
| `projectId`      | UUID        | 所屬 Project      |
| `name`           | varchar(50) | 顯示名稱          |
| `normalizedName` | varchar(50) | Server 正規化名稱 |
| `createdById`    | UUID        | 建立者            |
| `createdAt`      | timestamp   | 建立時間          |
| `updatedAt`      | timestamp   | 修改時間          |

`(projectId, normalizedName)` 建立 unique constraint。

#### Card

| 欄位          | 型別                | 說明                                |
| ------------- | ------------------- | ----------------------------------- |
| `id`          | UUID                | Card ID                             |
| `columnId`    | UUID                | 所屬 Column                         |
| `categoryId`  | UUID, nullable      | Project scope Category              |
| `title`       | varchar(200)        | Card 標題                           |
| `description` | text, nullable      | Card 描述                           |
| `position`    | integer             | 同一 Column 內排序位置              |
| `dueAt`       | timestamp, nullable | 到期時間，UTC                       |
| `version`     | integer             | Card optimistic concurrency version |
| `createdById` | UUID                | 建立者                              |
| `archivedAt`  | timestamp, nullable | 封存時間；不直接 hard delete        |
| `createdAt`   | timestamp           | 建立時間                            |
| `updatedAt`   | timestamp           | 修改時間                            |

Card 的狀態由所屬 Column 決定，不額外保存 `status`。Category 必須和 Card 所在 Board 屬於同一個 Project。

#### CardLabelAssignment

| 欄位         | 型別      | 說明     |
| ------------ | --------- | -------- |
| `cardId`     | UUID      | Card ID  |
| `labelId`    | UUID      | Label ID |
| `assignedAt` | timestamp | 指派時間 |

Primary key 使用 `(cardId, labelId)`。Label 必須和 Card 所在 Board 屬於同一個 Project。跨 table scope 由 application service 驗證。

#### CommandReceipt

| 欄位          | 型別        | 說明                          |
| ------------- | ----------- | ----------------------------- |
| `commandId`   | UUID        | Client 產生的 idempotency key |
| `userId`      | UUID        | 發出 command 的使用者         |
| `boardId`     | UUID        | 目標 Board                    |
| `eventName`   | varchar(80) | 例如 `card:move`              |
| `payloadHash` | varchar(64) | canonical payload SHA-256     |
| `ackData`     | jsonb       | 第一次處理後的成功 ack data   |
| `createdAt`   | timestamp   | 建立時間                      |

`commandId` 應有 unique constraint。同一個 `commandId` 只能代表同一個 user、event 與 payload；如果相同 ID 搭配不同內容，Server 回覆 idempotency key reused error。

#### BoardEvent（Recovery 階段）

| 欄位         | 型別           | 說明                        |
| ------------ | -------------- | --------------------------- |
| `boardId`    | UUID           | Board ID                    |
| `revision`   | bigint         | Board 內單調遞增序號        |
| `eventId`    | UUID           | Event ID                    |
| `commandId`  | UUID, nullable | 產生此 event 的 command     |
| `actorId`    | UUID           | 操作者                      |
| `eventName`  | varchar(80)    | 例如 `card:moved`           |
| `payload`    | jsonb          | Authoritative event payload |
| `occurredAt` | timestamp      | 事件時間                    |

Primary key 可使用 `(boardId, revision)`。MVP 可以先不建立 `BoardEvent`，改成 revision 不一致時要求完整 resync；進入 recovery 階段後再加入 replay。

### 3.2 Position 策略

初始位置以固定間隔產生，例如 `1024`、`2048`、`3072`。插入兩筆之間時由 Server 計算中間值；沒有空間時，由 Server 在 transaction 內重新編排該 Column。

Client 傳 `beforeCardId` 或 `afterCardId`，不要直接傳可信任的 `position`。Server 必須確認參考 Card 確實位於目標 Column。

## 4. 共用 TypeScript contracts

建議在 `packages/contracts` 新增：

```text
packages/contracts/
├── api.ts
├── auth.ts
├── workspaces.ts
├── project.ts
├── board.ts
├── board-socket.ts
└── socket.ts
```

`workspaces.ts`、`project.ts`、`board.ts` 放 HTTP 與 domain DTO；`board-socket.ts` 放 Board command、event 與 ack；`socket.ts` 只組合完整的 Client/Server event maps。

以下是 Board vertical slice 的目標 contract，不是目前 `packages/contracts/workspaces.ts` 的完成狀態。目前的 `WorkspaceDto` 尚未回傳 `createdById`、`archivedAt`，`WorkspaceListItemDto` 也尚未有 member／project counts；實作 Phase 1 時必須同一個變更內更新 contracts、Service mapping、Swagger 與測試。

### 4.1 DTO 基礎型別

```ts
export type WorkspaceRole = "OWNER" | "MEMBER";
export type ProjectRole = "OWNER" | "EDITOR" | "VIEWER";
export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED";
export type ColumnColorKey = "ready" | "active" | "review" | "done";
export type CardCategoryColorKey =
  | "coral" | "rose" | "orange" | "amber" | "lime" | "mint" | "teal"
  | "cyan" | "blue" | "indigo" | "lavender" | "violet" | "pink" | "slate";

export interface MemberUserDto {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface WorkspaceMemberDto {
  memberId: string;
  displayName: string;
  avatarUrl: string | null;
  role: WorkspaceRole;
}

export interface ProjectMemberDto extends MemberUserDto {
  role: ProjectRole;
  joinedAt: string;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  createdById: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceListItemDto extends WorkspaceDto {
  currentUserRole: WorkspaceRole;
  memberCount: number;
  accessibleProjectCount: number;
}

export interface BoardSummaryDto {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  isPrimary: boolean;
  position: number;
  archivedAt: string | null;
  updatedAt: string;
}

export interface ProjectDto {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdById: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummaryDto extends ProjectDto {
  currentUserRole: ProjectRole;
  primaryBoard: Pick<BoardSummaryDto, "id" | "name"> | null;
  memberCount: number;
}

export interface CardCategoryDto {
  id: string;
  projectId: string;
  name: string;
  colorKey: CardCategoryColorKey;
}

export interface CardLabelDto {
  id: string;
  projectId: string;
  name: string;
}

export interface CardDto {
  id: string;
  columnId: string;
  categoryId: string | null;
  labelIds: string[];
  title: string;
  description: string | null;
  position: number;
  dueAt: string | null;
  version: number;
  createdById: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoardColumnDto {
  id: string;
  boardId: string;
  title: string;
  colorKey: ColumnColorKey;
  position: number;
  version: number;
  cards: CardDto[];
}

export interface BoardSnapshotDto {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  isPrimary: boolean;
  position: number;
  version: number;
  revision: string;
  currentUserRole: ProjectRole;
  project: {
    id: string;
    workspaceId: string;
    name: string;
    status: ProjectStatus;
  };
  members: ProjectMemberDto[];
  categories: CardCategoryDto[];
  labels: CardLabelDto[];
  columns: BoardColumnDto[];
  createdAt: string;
  updatedAt: string;
}
```

所有時間都是 ISO 8601 UTC 字串。Nullable 欄位使用明確的 `null`；request 中省略欄位代表未修改，明確傳入 `null` 代表清除該欄位。

## 5. HTTP API 通則

### 5.1 Authentication

- 所有 `/workspaces`、`/projects`、`/boards` endpoints 都套用 `SessionGuard`。
- Session ID 只能從 HttpOnly Cookie 取得。
- Request body 與 query 中的 `userId` 不可作為目前使用者身份。
- CORS 必須只允許設定中的 frontend origin，並開啟 credentials。

### 5.2 Response envelope

沿用現有 `ApiResponse<T>`：

```json
{
  "code": 1,
  "data": {},
  "message": "請求成功",
  "time": "2026-08-20T10:00:00.000Z",
  "error": null
}
```

Validation error：

```json
{
  "code": 0,
  "data": null,
  "message": "請求參數錯誤",
  "time": "2026-08-20T10:00:00.000Z",
  "error": {
    "name": {
      "value": "",
      "messages": ["看板名稱不可為空"]
    }
  }
}
```

目前 backend validation 使用 application code `0`，並因 `stopAtFirstError: true` 每個欄位只回第一個錯誤。下表的 `1001` 等 code 是後續集中 ErrorCode 後的目標值，不能在 contracts 尚未修改前直接使用。

### 5.3 建議 application error codes

| Code   | HTTP status | 說明                               |
| ------ | ----------- | ---------------------------------- |
| `1`    | 2xx         | 成功                               |
| `1001` | 400         | Validation failed                  |
| `1002` | 400         | Invalid cursor/query               |
| `2001` | 401         | Session 不存在或失效               |
| `2002` | 403         | 權限不足                           |
| `3001` | 404         | Board 不存在或不可存取             |
| `3002` | 404         | Column 不存在                      |
| `3003` | 404         | Card 不存在                        |
| `3004` | 409         | Member 已存在                      |
| `3005` | 404         | Workspace 不存在或不可存取         |
| `3006` | 404         | Project 不存在或不可存取           |
| `3007` | 404         | Card category 不存在               |
| `3008` | 404         | Card label 不存在                  |
| `4001` | 409         | Version conflict                   |
| `4002` | 409         | Command ID 被不同 payload 重複使用 |
| `4003` | 409         | 最後一位 Owner 不可移除或降級      |
| `4290` | 429         | Rate limit exceeded                |
| `5000` | 500         | 非預期錯誤                         |

對沒有 membership 的使用者，建議回覆 `404`，避免透露 Workspace、Project 或 Board 是否存在。已確認具有 membership、但角色不足時才回 `403`。

Board 的授權路徑固定為：

```text
Board → Project → ProjectMember
```

`WorkspaceMember` 只代表使用者屬於該工作區；是否能讀寫某個 Project 與其 Boards，仍由 `ProjectMember` 決定。

## 6. Workspace、Project 與 Board REST API

### 6.1 `GET /workspaces`

取得目前使用者加入的 Workspace 清單。

Query：

| 欄位     | 必填 | 說明                       |
| -------- | ---- | -------------------------- |
| `cursor` | 否   | 上一頁回傳的 opaque cursor |
| `limit`  | 否   | 預設 20，最大 50           |

Response data 使用 cursor envelope，`items` 為 `WorkspaceListItemDto[]`。排序建議：`updatedAt DESC, id DESC`。

### 6.2 `POST /workspaces`

建立 Workspace，並在同一個 transaction 內將建立者加入 `WorkspaceMember`，角色為 `OWNER`。

Request：

```json
{
  "name": "Jeffery 的工作區"
}
```

成功：`201 Created`，回傳 `WorkspaceDto` 加上 `currentUserRole: "OWNER"`。

### 6.3 `GET /workspaces/:workspaceId/projects`

取得目前使用者在該 Workspace 中實際具有 `ProjectMember` 關係的 Projects。只有 `WorkspaceMember`、但未加入某個 Project，不應在此清單看見該 Project。

Query 可沿用 cursor pagination，`items` 為 `ProjectSummaryDto[]`。每個 Project summary 包含：

- `id`、`name`、`description`、`status`。
- 目前使用者的 `ProjectRole`。
- primary Board 的 `id` 與名稱，供前端直接導頁。
- Project member 數與 `updatedAt`。

### 6.4 `POST /workspaces/:workspaceId/projects`

Workspace 的 `OWNER` 或 `MEMBER` 都可以建立 Project。Server 必須在同一個 transaction 內：

1. 建立 Project。
2. 將建立者加入 `ProjectMember`，角色為 `OWNER`。
3. 建立一個 `isPrimary = true` 的 Board。
4. 在 primary Board 建立四個預設 Columns。

Request：

```json
{
  "name": "Kanban Side Project",
  "description": "練習 NestJS、WebSocket、Redis 與 Message Queue"
}
```

預設 Columns：

| Title    | colorKey | position |
| -------- | -------- | -------- |
| 準備開始 | `ready`  | 1024     |
| 正在進行 | `active` | 2048     |
| 等待檢視 | `review` | 3072     |
| 已完成   | `done`   | 4096     |

成功：`201 Created`，回傳：

```ts
interface CreateProjectResponse {
  project: ProjectDto;
  currentUserRole: "OWNER";
  primaryBoard: BoardSummaryDto;
}
```

前端接著以 `GET /boards/:boardId` 取得 snapshot。

### 6.5 `GET /projects/:projectId`

需要 `ProjectMember`。回傳：

```ts
interface ProjectDetailResponse {
  project: ProjectDto;
  currentUserRole: ProjectRole;
  members: ProjectMemberDto[];
  boards: BoardSummaryDto[];
  categories: CardCategoryDto[];
  labels: CardLabelDto[];
}
```

這個 endpoint 不塞入所有 Cards。

### 6.6 `GET /boards/:boardId`

取得完整 authoritative snapshot。

Server 行為：

1. 由 Board 找到 Project，驗證 `ProjectMember`。
2. 查詢 Board、Project members、categories、labels、columns 與未封存 cards。
3. 依 `position` 排序 Columns 與 Cards。
4. 回傳 `BoardSnapshotDto`。

成功：`200 OK`。這個 endpoint 用於：

- 第一次進入 Board。
- Socket reconnect 後無法 replay。
- Client 偵測 event revision gap。
- Version conflict 後需要完整校正。

### 6.7 Board 建立、封存與刪除

第一版一個 Project 只需要建立時自動產生的 primary Board，因此可延後獨立的 Board CRUD。未來若開放多 Board：

- `POST /projects/:projectId/boards`：`OWNER`、`EDITOR` 可建立。
- `DELETE /boards/:boardId`：僅 `OWNER`，優先採 soft delete。
- primary Board 不可直接刪除；必須先指定另一個 primary Board，或封存整個 Project。
- Board 被封存或刪除後，向 room 發出 `board:deleted` 或新增明確的 `board:archived` event，並讓 sockets 離開 room。

## 7. Member 與 Card metadata REST API

### 7.1 Workspace members

- `GET /workspaces/:workspaceId/members`：Workspace member 可讀。
- `POST /workspaces/:workspaceId/members`：僅 Workspace `OWNER`，第一版只加入已註冊使用者。
- `PATCH /workspaces/:workspaceId/members/:memberId`：僅 `OWNER`；不可將最後一位 Workspace `OWNER` 降級。
- `DELETE /workspaces/:workspaceId/members/:memberId`：僅 `OWNER` 或成員自行離開；不可移除最後一位 `OWNER`。

若使用者被移出 Workspace，Server 必須同步移除其下所有 `ProjectMember` 關係，或拒絕操作直到 Project memberships 已處理完畢；實作時應放在同一個 transaction，避免殘留越權資料。

### 7.2 Project members

- `GET /projects/:projectId/members`：Project member 可讀。
- `POST /projects/:projectId/members`：僅 Project `OWNER`；目標使用者必須已是 `WorkspaceMember`。
- `PATCH /projects/:projectId/members/:userId`：僅 `OWNER`；不可將最後一位 Project `OWNER` 降級。
- `DELETE /projects/:projectId/members/:userId`：`OWNER` 或成員自行離開；不可移除最後一位 `OWNER`。

新增 Request：

```json
{
  "email": "member@example.com",
  "role": "EDITOR"
}
```

Project member 被移除或降級後，權限異動立即套用到該 Project 的所有 Boards。Server 必須讓被移除者的 sockets 離開相關 Board rooms，發送 `board:access-revoked`，Client 導回 Project 或 Workspace 頁面。

### 7.3 `GET /projects/:projectId/card-categories`

Project member 可讀，回傳 `CardCategoryDto[]`。因 snapshot 已包含 categories，此 endpoint 主要供獨立管理頁面或重新整理選項使用。

### 7.4 `POST /projects/:projectId/card-categories`

Project `OWNER`、`EDITOR` 可建立。

```json
{
  "name": "前端",
  "colorKey": "blue"
}
```

Category 名稱在同一 Project 內建議做 trim 後的 case-insensitive unique。`colorKey` 只能是前後端共用的允許值，不接受任意色碼。

### 7.5 `GET /projects/:projectId/card-labels`

Project member 可讀，回傳 `CardLabelDto[]`。

### 7.6 `POST /projects/:projectId/card-labels`

Project `OWNER`、`EDITOR` 可建立。

```json
{
  "name": "高優先"
}
```

Label 名稱的正規化與唯一性原則同 Category，但 Label 第一版不保存顏色。更新與刪除 endpoints 可在 Card CRUD 穩定後補上；刪除已被使用的 Category/Label 時，第一版建議採封存或拒絕刪除，避免歷史資料突然失去語意。

## 8. Socket.IO connection authentication

### 8.1 Handshake

Client：

```ts
const socket = io(apiUrl, {
  autoConnect: false,
  withCredentials: true,
});
```

Server middleware：

1. 檢查 handshake `Origin` 是否在 allowlist。
2. 從 handshake cookie 解析 `sessionId`。
3. 使用既有 `SessionService` 驗證 Redis Session。
4. 將 `userId` 放入 `socket.data.userId`。
5. Session 無效時拒絕連線，不建立匿名 socket。

Connect error data：

```ts
interface SocketConnectErrorData {
  code: 2001;
  message: string;
}
```

Client 監聽 `connect_error`；收到 `2001` 時清除前端使用者狀態並導向 login，不做無限 reconnect。

### 8.2 Session lifecycle

- Socket 連線成功不代表 Session 永遠有效。
- 每個敏感 command 至少重新確認 `socket.data.userId` 與該 Board 所屬 Project 的 `ProjectMember`。
- 若系統支援 Session 主動撤銷，應能 disconnect 該使用者的 sockets。
- 不記錄 raw Session ID、Cookie、password 或完整敏感 payload。

## 9. Rooms 與 authorization

### 9.1 Rooms

| Room              | 用途                                 |
| ----------------- | ------------------------------------ |
| `board:{boardId}` | Board domain events 與 presence      |
| `user:{userId}`   | 成員異動、權限撤銷等個人通知；可延後 |

Client 只傳 `boardId`。Server 在驗證 UUID，並透過 `Board → Project → ProjectMember` 完成授權後，自行組出 room name。

### 9.2 Role permissions

| 操作                  | OWNER | EDITOR | VIEWER |
| --------------------- | ----- | ------ | ------ |
| 讀取 snapshot         | 是    | 是     | 是     |
| 加入 Board room       | 是    | 是     | 是     |
| 建立/修改/移動 Card   | 是    | 是     | 否     |
| 建立/修改/移動 Column | 是    | 是     | 否     |
| 修改 Board metadata   | 是    | 否     | 否     |
| 管理 Project members  | 是    | 否     | 否     |
| 刪除 Board            | 是    | 否     | 否     |

加入 room 時驗證一次不夠。每個 command 都必須再次驗證目前 `ProjectMember` 與 role，因為使用者可能在連線期間被移除或降級。

## 10. Socket.IO 共用契約

### 10.1 Command metadata

```ts
export interface CommandMeta {
  commandId: string;
  boardId: string;
  clientTime?: string;
}
```

- `commandId` 由 Client 每次「使用者意圖」產生 UUID。
- Retry 必須沿用相同 `commandId`。
- 使用者再次手動操作才建立新 ID。
- `clientTime` 只能用於 log/debug，不可作為 Server 排序依據。

### 10.2 Domain event metadata

```ts
export interface DomainEventMeta {
  eventId: string;
  commandId: string | null;
  boardId: string;
  boardRevision: string;
  actorId: string;
  occurredAt: string;
}
```

### 10.3 Ack

```ts
export type CommandAck<T> =
  | {
      ok: true;
      commandId: string;
      data: T;
      serverTime: string;
    }
  | {
      ok: false;
      commandId: string;
      error: SocketCommandError;
      serverTime: string;
    };
```

共用 alias 可以定義為：

```ts
export interface SocketCommandError {
  code: number;
  message: string;
  fields?: Record<string, string[]>;
  retryable: boolean;
  current?: unknown;
}

export interface MutationAckData<T> {
  entity: T;
  boardRevision: string;
  eventId: string;
}

export type BasicAck = CommandAck<null>;
export type BoardCommandAck = CommandAck<
  MutationAckData<{
    id: string;
    name: string;
    description: string | null;
    version: number;
  }>
>;
export type ColumnCommandAck = CommandAck<MutationAckData<BoardColumnDto>>;
export type CardCommandAck = CommandAck<MutationAckData<CardDto>>;

export interface BoardDomainEvent {
  name: keyof ServerToClientEvents;
  meta: DomainEventMeta;
  payload: unknown;
}
```

完整實作時應將 `BoardDomainEvent` 改成以 `name` 為 discriminator 的 union，使 replay payload 也能得到精確型別；草案先用 `unknown` 表示 reducer 必須再次依 event name 收窄。

Ack 只回覆 command sender；domain event 廣播給整個 Board room，包含 sender。Sender 必須能處理 domain event 比 ack 先抵達的情況。

### 10.4 完整 event maps

```ts
export interface ClientToServerEvents {
  "board:join": (
    payload: BoardJoinCommand,
    ack: (result: BoardJoinAck) => void,
  ) => void;
  "board:leave": (
    payload: BoardLeaveCommand,
    ack: (result: BasicAck) => void,
  ) => void;
  "board:update": (
    payload: UpdateBoardCommand,
    ack: (result: BoardCommandAck) => void,
  ) => void;
  "column:create": (
    payload: CreateColumnCommand,
    ack: (result: ColumnCommandAck) => void,
  ) => void;
  "column:update": (
    payload: UpdateColumnCommand,
    ack: (result: ColumnCommandAck) => void,
  ) => void;
  "column:move": (
    payload: MoveColumnCommand,
    ack: (result: ColumnCommandAck) => void,
  ) => void;
  "card:create": (
    payload: CreateCardCommand,
    ack: (result: CardCommandAck) => void,
  ) => void;
  "card:update": (
    payload: UpdateCardCommand,
    ack: (result: CardCommandAck) => void,
  ) => void;
  "card:move": (
    payload: MoveCardCommand,
    ack: (result: CardCommandAck) => void,
  ) => void;
  "card:archive": (
    payload: ArchiveCardCommand,
    ack: (result: CardCommandAck) => void,
  ) => void;
}

export interface ServerToClientEvents {
  "board:updated": (event: BoardUpdatedEvent) => void;
  "board:deleted": (event: BoardDeletedEvent) => void;
  "board:access-revoked": (event: BoardAccessRevokedEvent) => void;
  "board:resync-required": (event: BoardResyncRequiredEvent) => void;
  "board:presence-updated": (event: BoardPresenceUpdatedEvent) => void;
  "column:created": (event: ColumnCreatedEvent) => void;
  "column:updated": (event: ColumnUpdatedEvent) => void;
  "column:moved": (event: ColumnMovedEvent) => void;
  "card:created": (event: CardCreatedEvent) => void;
  "card:updated": (event: CardUpdatedEvent) => void;
  "card:moved": (event: CardMovedEvent) => void;
  "card:archived": (event: CardArchivedEvent) => void;
}
```

## 11. Room lifecycle events

### 11.1 `board:join`

Request：

```ts
interface BoardJoinCommand {
  boardId: string;
  lastKnownRevision?: string;
}
```

Ack：

```ts
type BoardJoinAck =
  | {
      ok: true;
      data: {
        boardId: string;
        latestRevision: string;
        recovery: "UP_TO_DATE" | "REPLAYED" | "RESYNC_REQUIRED";
        replayedEvents?: BoardDomainEvent[];
      };
      serverTime: string;
    }
  | {
      ok: false;
      error: SocketCommandError;
      serverTime: string;
    };
```

Server 流程：

1. 驗證 `boardId` 格式。
2. 由 Board 找到 Project，再查詢目前使用者的 `ProjectMember`；無法存取時回 `3001`。
3. 加入 `board:{boardId}`。
4. 比較 `lastKnownRevision` 與 Server revision。
5. 相同則回 `UP_TO_DATE`。
6. 可取得完整連續事件時回 `REPLAYED`。
7. 無 event log、事件過期或 revision gap 時回 `RESYNC_REQUIRED`。

第一次進入 Board 的建議順序：

```text
GET /boards/:boardId
  → 保存 snapshot.revision
socket.connect()
  → board:join({ boardId, lastKnownRevision })
  → 套用 replay，或在 RESYNC_REQUIRED 時重新 GET snapshot
```

這個順序避免「HTTP snapshot 完成到加入 room 之間」發生的異動永久遺失。

### 11.2 `board:leave`

Request：

```ts
interface BoardLeaveCommand {
  boardId: string;
}
```

離開頁面時主動 leave；斷線時 Socket.IO 自動移除 room membership。Server 必須同步更新 presence socket count。

## 12. Board command

### 12.1 `board:update`

僅 `OWNER`。

```ts
interface UpdateBoardCommand extends CommandMeta {
  expectedVersion: number;
  patch: {
    name?: string;
    description?: string | null;
  };
}
```

至少需有一個 patch 欄位。成功後：

- Board `version + 1`。
- Board `revision + 1`。
- Broadcast `board:updated`，payload 包含完整更新後 Board metadata。

## 13. Column commands

### 13.1 `column:create`

```ts
interface CreateColumnCommand extends CommandMeta {
  title: string;
  colorKey?: ColumnColorKey;
  beforeColumnId?: string;
  afterColumnId?: string;
}
```

Rules：

- `beforeColumnId` 與 `afterColumnId` 最多提供一個。
- 參考 Column 必須屬於同一 Board。
- 未提供參考 ID 時放在最後。
- Server 決定 `position`。

成功 broadcast：

```ts
interface ColumnCreatedEvent {
  meta: DomainEventMeta;
  column: BoardColumnDto;
}
```

### 13.2 `column:update`

```ts
interface UpdateColumnCommand extends CommandMeta {
  columnId: string;
  expectedVersion: number;
  patch: {
    title?: string;
    colorKey?: ColumnColorKey;
  };
}
```

成功後 Column `version + 1`，broadcast `column:updated`。

### 13.3 `column:move`

```ts
interface MoveColumnCommand extends CommandMeta {
  columnId: string;
  expectedVersion: number;
  beforeColumnId?: string;
  afterColumnId?: string;
}
```

Server 在 transaction 中計算 position，必要時重新編排。Event 應至少包含：

```ts
interface ColumnMovedEvent {
  meta: DomainEventMeta;
  columnId: string;
  position: number;
  version: number;
  reorderedColumns?: Array<{
    id: string;
    position: number;
    version: number;
  }>;
}
```

只有發生 rebalance 時才需要 `reorderedColumns`。

### 13.4 Column delete

第一版建議不做。刪除含有 Cards 的 Column 需要先決定：禁止、封存全部、或移至另一 Column。等產品行為確定後再新增 `column:archive`，不要直接 hard delete。

## 14. Card commands

### 14.1 `card:create`

```ts
interface CreateCardCommand extends CommandMeta {
  columnId: string;
  title: string;
  description?: string;
  dueAt?: string;
  categoryId?: string | null;
  labelIds?: string[];
  beforeCardId?: string;
  afterCardId?: string;
}
```

Rules：

- `title` trim 後長度 1 到 200。
- `description` 設定合理上限，例如 10,000 字元。
- `dueAt` 必須是可解析的 ISO 8601 timestamp，Server 轉 UTC 保存。
- Column 必須屬於 meta 中的 Board。
- `categoryId` 若有值，必須屬於 Board 所在的 Project。
- 所有 `labelIds` 必須屬於同一 Project；Server 先去重，再寫入 `CardLabelAssignment`。
- 未指定位置時放在 Column 最後。

成功 broadcast：

```ts
interface CardCreatedEvent {
  meta: DomainEventMeta;
  card: CardDto;
}
```

### 14.2 `card:update`

```ts
interface UpdateCardCommand extends CommandMeta {
  cardId: string;
  expectedVersion: number;
  patch: {
    title?: string;
    description?: string | null;
    dueAt?: string | null;
    categoryId?: string | null;
    labelIds?: string[];
  };
}
```

Rules：

- Patch 至少一個欄位。
- Card 必須透過 Column 關係屬於指定 Board。
- `categoryId` 與 `labelIds` 必須屬於 Board 所在的 Project；明確的 `categoryId: null` 代表清除 Category。
- 有傳 `labelIds` 時視為完整取代目前 Labels，Server 在同一個 transaction 更新 assignments；未傳則維持不變。
- 使用 `WHERE id = cardId AND version = expectedVersion` 或等價 transaction 檢查。
- 成功後 `version + 1`。

成功 broadcast `card:updated`，包含完整更新後 `CardDto`。

### 14.3 `card:move`

```ts
interface MoveCardCommand extends CommandMeta {
  cardId: string;
  targetColumnId: string;
  expectedVersion: number;
  beforeCardId?: string;
  afterCardId?: string;
}
```

Rules：

- Source Card 與 target Column 都必須屬於同一 Board。
- `beforeCardId`/`afterCardId` 必須位於 target Column。
- 跨 Column 與同 Column reorder 使用同一 command。
- Server 在 transaction 中更新 `columnId`、`position` 與 `version`。

Event：

```ts
interface CardMovedEvent {
  meta: DomainEventMeta;
  card: CardDto;
  sourceColumnId: string;
  targetColumnId: string;
  reorderedCards?: Array<{
    id: string;
    columnId: string;
    position: number;
    version: number;
  }>;
}
```

### 14.4 `card:archive`

```ts
interface ArchiveCardCommand extends CommandMeta {
  cardId: string;
  expectedVersion: number;
}
```

Server 設定 `archivedAt`，不 hard delete。成功 broadcast `card:archived`，Client 從目前 Column 移除 Card。

## 15. Server command processing pipeline

所有 mutation command 使用相同流程：

```text
收到 command
  → runtime validation
  → 取得 socket.data.userId
  → Board 找到 Project，驗證 ProjectMember 與 role
  → 檢查 commandId 是否已處理
  → 檢查 resource 是否屬於 Board
  → transaction：version check + mutation + revision + receipt/event
  → commit
  → broadcast authoritative domain event
  → ack sender
```

Gateway 只負責傳輸層：validation、取得 socket context、呼叫 application service、broadcast/ack。Transaction、ProjectMember policy、idempotency 與 domain rules 不要寫在 Gateway callback 裡。

建議 backend 結構：

```text
backend/src/
├── board/
│   ├── board.module.ts
│   ├── board.controller.ts
│   ├── board.gateway.ts
│   ├── board.service.ts
│   ├── board.repository.ts
│   ├── board-policy.service.ts
│   └── dto/
├── column/
└── card/
```

初期也可以全部放在 `board/` module，但仍將 controller、gateway、service、repository 分開。

## 16. Idempotency 與 retry

### 16.1 Client 規則

```ts
const commandId = crypto.randomUUID();

socket
  .timeout(5000)
  .emit(
    "card:move",
    { commandId, boardId, cardId, targetColumnId, expectedVersion },
    (timeoutError, ack) => {
      // timeoutError 代表結果未知，不代表 Server 一定失敗。
    },
  );
```

- Timeout 表示「結果未知」，不可直接視為操作失敗。
- Retry 需使用相同 `commandId` 與完全相同 payload。
- 建議最多 retry 2 次，採短暫 exponential backoff + jitter。
- 超過 retry 次數後標記畫面為同步狀態未知，重新取得 snapshot。

### 16.2 Server 規則

第一次收到：

1. 執行 transaction。
2. 保存 `CommandReceipt`。
3. Broadcast domain event。
4. 回成功 ack。

重複收到相同 command：

1. 不再次修改資料。
2. 不再次 broadcast domain event。
3. 回傳原本保存的成功 ack data。

相同 command ID 但 event/payload/user 不同：回 `4002`，`retryable: false`，並記錄 security warning。

「先查 receipt、再寫資料」本身不能防止兩個相同 command 同時抵達。真正的保護必須是 transaction 內的 `CommandReceipt.commandId` unique constraint：只有一個 transaction 可以成功建立 receipt；另一個 transaction 遇到 unique conflict 後重新讀取 receipt，回傳原始 ack。

建議 receipt 至少保存 24 小時，清理工作可在後續用排程處理。

### 16.3 Delivery semantics 與 crash window

PostgreSQL transaction 無法和 Socket.IO network emit 組成同一個 atomic transaction，因此必須接受以下事實：

- Ack timeout 可能發生在 DB 已 commit 之後。
- Client 可能收到 domain event，但 sender 尚未收到 ack。
- Server 可能在 DB commit 後、broadcast 前 crash。
- Socket event 可能重複或遺失，Client reducer 必須 idempotent。

MVP 的保證是：

- `CommandReceipt` 讓相同 command 的資料庫副作用有效地只發生一次。
- 即時 event 採 best effort；revision gap 或 reconnect 時以 snapshot 修正。
- 重複 command 回原始 ack，不重新產生資料庫副作用，也不重新產生新的 event ID。

Recovery 階段應將 `BoardEvent` 與 domain mutation 寫在同一個 DB transaction。如此即使 Server 在 commit 後、broadcast 前 crash，reconnect 時仍能從 event log replay 原本的 event。若未來需要更強的背景投遞保證，再加入 transactional outbox；不要誤稱一般 Socket.IO emit 具有 exactly-once delivery。

## 17. Optimistic concurrency

### 17.1 Version conflict

所有 edit、move、archive command 都攜帶目前 Client 看見的 `expectedVersion`。

若 Server version 已不同，回：

```json
{
  "ok": false,
  "commandId": "d65a...",
  "error": {
    "code": 4001,
    "message": "卡片已被其他使用者更新",
    "retryable": false,
    "current": {
      "id": "card-id",
      "title": "Server 上的最新標題",
      "version": 8
    }
  },
  "serverTime": "2026-08-20T10:00:00.000Z"
}
```

Client 不自動用舊內容覆蓋。建議行為：

- Move conflict：使用 `current` 校正 Card 位置並提示使用者。
- Edit conflict：保留使用者輸入草稿，顯示 Server 最新資料，讓使用者決定重新套用。
- 多個 revision gap：直接 resync snapshot。

### 17.2 Board revision

Entity `version` 解決單一 Entity 的競爭；Board `revision` 解決 Client 是否漏掉 domain event。

Client 收到 event：

```text
event.revision = localRevision + 1 → 套用 event
event.revision <= localRevision    → 重複 event，忽略
event.revision > localRevision + 1 → 發現 gap，停止 optimistic write 並 resync
```

Client 以 `BigInt(event.meta.boardRevision)` 比較，store 仍可保存原始字串供序列化。

## 18. Optimistic UI

Pinia board store 建議保存：

```ts
interface PendingCommand {
  commandId: string;
  eventName: string;
  status: "SENDING" | "RETRYING" | "UNKNOWN";
  rollbackData: unknown;
}
```

流程：

1. 使用者操作時產生 command ID。
2. 先更新本地 UI，Card 顯示輕量 syncing state。
3. 將 command 存入 `pendingCommands`。
4. 收到含相同 command ID 的 authoritative event 時 reconcile。
5. 收到成功 ack 但尚未收到 event 時，可使用 ack data 校正。
6. 收到 validation/authorization error 時 rollback。
7. Ack timeout 時不要立刻 rollback；retry 相同 command ID。
8. 無法確定結果時取得 snapshot。

Event handler 必須能安全處理重複 event，不可因重複 `card:created` 產生兩張 Card。

## 19. Reconnect 與 recovery

### 19.1 三個不同概念

- Reconnect：Transport 重新連上。
- Recovery：補回離線期間漏掉的 events。
- Resync：放棄增量補回，重新取得完整 snapshot。

Reconnect 成功不代表資料已同步，也不代表 client 仍在 Board room。

### 19.2 MVP reconnect

MVP 尚未建立 `BoardEvent` 時：

1. Socket reconnect。
2. Client emit `board:join`，帶 `lastKnownRevision`。
3. Revision 相同則繼續。
4. Revision 不同則 Server 回 `RESYNC_REQUIRED`。
5. Client `GET /boards/:boardId` 覆蓋 store。
6. 清理或重新評估 pending commands。

### 19.3 Event replay 階段

有 `BoardEvent` 後：

- Server 查詢 `revision > lastKnownRevision` 的 events。
- Events 必須連續，且數量不可超過設定上限。
- 可 replay 時依 revision 升冪回傳。
- Event 缺漏、超過保留期或超過上限時要求 resync。
- Replay 的 event handler 與即時 event handler 使用同一套 reducer。

## 20. Presence

Presence 是暫時連線資訊，不寫入 Board/Card 資料表。

同一使用者可能開多個 tab，因此應以 `(boardId, userId)` 對應 socket count：

- 第一個 socket join 時，使用者變 online。
- 額外 tab join 只增加 count。
- socket disconnect/leave 時減少 count。
- count 變 0 才 broadcast offline。

Event：

```ts
interface BoardPresenceUpdatedEvent {
  boardId: string;
  onlineUserIds: string[];
  occurredAt: string;
}
```

Presence 不參與權限判斷，也不保證百分之百即時正確。第一版可只顯示 online member，不做游標或正在編輯提示。

## 21. Validation 與 security

### 21.1 Runtime validation

TypeScript interface 不會在 runtime 保護 Server。Socket payload 必須使用 Zod、class-validator 或一致的 runtime schema 驗證。

最低限制：

- 所有 IDs 驗證 UUID 格式。
- title、name、description 有長度上限。
- 不接受 DTO 未定義欄位。
- Date 驗證格式並轉 UTC。
- `beforeId` 與 `afterId` 不可同時提供。
- Patch 至少有一個允許欄位。

### 21.2 Authorization

- 不信任 client 傳來的 user identity。
- 不只驗證 Board ID，還要驗證 Card → Column → Board 關係。
- Join room 與每個 command 都透過 `Board → Project → ProjectMember` 檢查權限。
- ProjectMember 被移除後，立即離開該 Project 的所有 Board rooms。
- Error response 不回傳其他 Board 的 entity data。

### 21.3 Cookie 與 origin

- HttpOnly、Secure（production）、合理的 SameSite。
- Socket handshake 驗證 Origin allowlist，防止其他網站借用瀏覽器 Cookie 建立連線。
- 若 frontend/backend 未來採跨站部署，需重新評估 SameSite 與 CSRF 防護，不要只放寬 CORS。

### 21.4 Abuse control

後續可加入：

- 每個 user/socket 的 command rate limit。
- 單一 Board 最大 Column/Card 數量。
- description payload 大小限制。
- 連續 validation failure log/限制。

## 22. Logging 與 observability

每個 Socket command structured log 建議包含：

```text
eventName
commandId
socketId
userId
boardId
resourceId
durationMs
resultCode
```

不可記錄：

- Cookie。
- raw Session ID。
- password。
- 完整敏感 description。

非預期錯誤回覆固定 generic message，詳細 stack 只進 Server log。可以產生 `traceId` 放入 ack，方便對照 log。

## 23. Frontend 建議流程

### 23.1 進入 Board 頁

```text
router 進入 /boards/:boardId
  → 開啟全域 Loading
  → GET Board snapshot
  → boardStore.replaceSnapshot(snapshot)
  → socket.connect（若尚未連線）
  → board:join(lastKnownRevision)
  → replay 或 resync
  → 關閉 Loading
```

### 23.2 離開 Board 頁

```text
board:leave
  → 移除 Board domain event listeners
  → 清理目前 Board state
```

不要在每次進入頁面時重複註冊匿名 event callback，否則回到頁面後可能套用同一 event 多次。Handler 應具名，並在 unmount 時使用同一 reference `socket.off`。

### 23.3 Loading 與 Alert

- 初始 snapshot 使用全域 Loading。
- 單張 Card optimistic operation 不使用全畫面 Loading，避免阻塞其他協作。
- Validation error 顯示欄位提示或局部訊息。
- Version conflict、權限撤銷或同步失敗可使用全域 Alert。

## 24. 測試策略

### 24.1 Unit tests

- Workspace／Project policy role matrix。
- Position 計算與 rebalance。
- Payload validation。
- Version conflict。
- 相同 command ID 只執行一次。
- 相同 command ID 不同 payload 回 `4002`。
- Revision reducer：正常、duplicate、gap。

### 24.2 Integration tests

使用真實 PostgreSQL、Redis 與兩個 Socket.IO clients：

1. 非 Project member 無法 join。
2. Viewer 可 join 但無法建立 Card。
3. Editor 建立 Card，兩個 clients 都收到同一 `card:created`。
4. Sender 收到成功 ack。
5. Retry 相同 command ID 不建立第二張 Card。
6. 兩個 clients 使用相同 Card version 修改，只有一個成功。
7. 移動 Card 後 snapshot 與 event 結果一致。
8. Project member 被移除後無法再收到該 Project 的 Board events。

### 24.3 Playwright multi-user tests

使用兩個 browser contexts，各自登入不同使用者：

- A 移動 Card，B 畫面更新。
- B 離線期間 A 修改資料，B reconnect 後 resync/replay。
- A、B 同時編輯 Card，衝突 UI 正確。
- Ack timeout + retry 不產生重複 Card。

## 25. 實作階段

### Phase 1：Workspace、Project 與 Board read model

- Prisma：Workspace、WorkspaceMember、Project、ProjectMember、Board、BoardColumn、CardCategory、CardLabel、Card、CardLabelAssignment。
- `POST /workspaces`、`GET /workspaces`。
- `POST /workspaces/:workspaceId/projects`、`GET /workspaces/:workspaceId/projects`。
- `GET /projects/:projectId`。
- `GET /boards/:boardId` snapshot。
- Frontend 使用 Workspace/Project 清單導頁，再以 snapshot render Board。

驗收：登入使用者可建立 Workspace 與 Project；Project 自動包含 primary Board、四個預設 Columns，重新整理後資料仍一致。

### Phase 2：Socket Session 與 room

- Handshake Cookie authentication。
- `socket.data.userId`。
- `board:join`、`board:leave`。
- 透過 ProjectMember authorization。

驗收：非 Project member 無法 join；Client payload 偽造 user ID 沒有作用。

### Phase 3：基本 Card commands

- `card:create`。
- `card:update`。
- `card:move`。
- Ack 與 authoritative events。
- 暫時不做 retry/idempotency。

驗收：兩個 clients 在同一 Board 看見即時異動。

### Phase 4：Column 與 archive

- Column create/update/move。
- Card archive。
- Position rebalance。

驗收：排序結果在 refresh 後維持一致。

### Phase 5：可靠性

- CommandReceipt。
- Ack timeout。
- Retry same command ID。
- Duplicate command tests。

驗收：故意丟棄第一次 ack 後 retry，不產生重複副作用。

### Phase 6：Concurrency

- Entity version。
- Version conflict ack。
- Frontend optimistic state reconcile/rollback。

驗收：兩位使用者同時修改同一 Card，不會靜默覆蓋。

### Phase 7：Recovery

- Board revision。
- Reconnect join protocol。
- MVP snapshot resync。
- BoardEvent replay（進階）。

驗收：離線後不論能否 replay，Client 最終都與 Server snapshot 一致。

### Phase 8：Members 與 presence

- WorkspaceMember／ProjectMember endpoints。
- Access revoked。
- Presence socket count。

驗收：降級或移除權限立即生效，多 tab 不會錯誤顯示離線。

## 26. 實作前需確認的產品決策

以下不阻塞 Phase 1，但進入對應功能前需要決定：

1. 新增 Workspace／Project member 是直接加入，還是需要 invitation acceptance。
2. Workspace `OWNER` 是否自動看見所有 Projects；目前規格採「仍須有 ProjectMember」的最小權限模型。
3. Project 是否允許多位 `OWNER`；不論結果為何，都不可移除或降級最後一位 Owner。
4. Column 是否允許刪除；含 Cards 時如何處理。
5. 使用中的 Category／Label 是禁止刪除、封存，還是從 Cards 解除關聯。
6. Card archive 是否提供復原與 archive list。
7. Version conflict UI 是直接採 Server 版本，還是提供草稿比較。
8. Presence 是否只顯示 online，還是需要「正在編輯」狀態。
9. BoardEvent 保存時間與每次 replay 上限。

## 27. 第一個建議 vertical slice

不要先一次建立所有 events。最適合的第一條完整切片是：

```text
POST Workspace
  → POST Project（同 transaction 建立 primary Board 與四個 Columns）
  → GET Board snapshot
  → board:join
  → card:create
  → PostgreSQL 寫入
  → card:created 廣播
  → ack
  → refresh 後資料仍存在
```

這條切片同時驗證 HTTP read、Socket auth、room authorization、DB persistence、broadcast 與 shared contracts。通過後再沿用相同 pipeline 加入 update、move、idempotency 與 concurrency。
