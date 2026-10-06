# Project 拖曳與 Redis Lock 規格（v1）

最後更新：2026-09-22。本文定義多人協作 Board 的拖曳互斥與同步策略；目前是設計規格，尚未接上 Socket、Redis lock 或 Card persistence。

## 目標與邊界

同一個 Project 同一時間只允許一個使用者執行拖曳操作：Column drag 與 Card drag 互斥。這把鎖只存在於使用者實際拖曳的短暫期間，不影響一般讀取、Card 內容編輯或新增 Card。

```text
Project drag session
├─ Column drag
└─ Card drag
```

- PostgreSQL 是 Project、Column、Card 與排序的持久化真相。
- Redis lock 協調即時互動，避免巢狀 Sortable 操作同時改動同一個 Project 的畫面。
- `Project.boardRevision` 是持久化排序寫入的 optimistic concurrency 保護，不能只依賴 Redis lock。
- Socket drag state 是暫態資料；漏收或重連後一律以 HTTP snapshot 恢復。
- Card title、description、label 等內容編輯使用 Card 自己的 version，不應因 Column／Card 拖曳的 board revision 改變而被拒絕。

## 為何 v1 鎖整個 Project 的拖曳

Card drag 會在 Column DOM 容器中運作，而 Column drag 會移動該容器。若 A 正把 Card 從 Column A 移到 Column B，B 同時移動 Column A 或 B，巢狀拖曳的暫態 DOM、drop target 與 payload 相鄰關係都可能失效。

v1 因此序列化同一 Project 的拖曳行為。這不代表鎖住整個 Board 的所有操作：一般 Card 編輯仍可和拖曳並行。日後若有多人高頻協作需求，再評估 source／target Column lock 與多鎖原子取得。

| A 的動作 | B 的動作 | v1 行為 |
| --- | --- | --- |
| 拖 Column | 拖任意 Column | 拒絕 B |
| 拖 Column | 拖任意 Card | 拒絕 B |
| 拖 Card | 拖任意 Column | 拒絕 B |
| 拖 Card | 拖任意 Card | 拒絕 B |
| 編輯 Card 內容 | 拖 Column／Card | 允許 |

## Redis lease lock

Key：

```text
project:{projectId}:drag-session
```

Value 只供 Backend／Redis 使用，不公開內部 `userId`：

```ts
type ProjectDragSession = {
  lockToken: string;
  userId: string;
  socketId: string;
  kind: 'COLUMN' | 'CARD';
  resourceId: string;
};
```

| 行為 | 規則 |
| --- | --- |
| acquire | `SET key value NX PX 15000`，只有第一個使用者成功 |
| lease TTL | 15 秒 |
| renew | 成功取得鎖的 client 每 5 秒 renew 一次 |
| release | drop 成功、取消、路由離開或 Socket disconnect |
| 非正常離開 | 等待 TTL 到期 |

renew 與 release 必須以 Lua compare-and-expire／compare-and-delete 驗證 `lockToken`，不得讓已過期的舊 client 延長或刪除新 client 的 lock。

## Socket protocol

Socket 使用既有 Session handshake 取得使用者身分並驗證 Project membership；client payload 不得傳入可信任的 userId。

```text
client → server
project:dragAcquire
project:dragRenew
project:dragRelease

server → client ack
project:dragAcquireResult

server → project:{projectId}
project:dragStateChanged
```

### Acquire

```ts
type ProjectDragAcquirePayload = {
  projectId: string;
  kind: 'COLUMN' | 'CARD';
  resourceId: string;
};

type ProjectDragAcquireAck =
  | {
      ok: true;
      lockToken: string;
      expiresAt: string;
    }
  | {
      ok: false;
      code: 'PROJECT_DRAG_LOCKED';
      holder: {
        projectMemberId: string;
        displayName: string;
      };
      expiresAt: string;
    };
```

### Room state event

```ts
type ProjectDragStateChanged = {
  projectId: string;
  state: 'ACTIVE' | 'RELEASED';
  kind?: 'COLUMN' | 'CARD';
  resourceId?: string;
  holder?: {
    projectMemberId: string;
    displayName: string;
  };
  expiresAt?: string;
};
```

Room event 不傳游標座標、每次 hover target 或暫態 DOM position。其他 client 只需知道 Project 正被拖曳，並暫時停用 Column／Card drag handles。

## 前端互動

Column 排序使用 `vue-draggable-plus`。僅 `.board__column-handle` 可開始 Column drag；未來 Card 另有自己的 Card handle。Column 的 header、Cards 區、Card 內容、表單與選單不應直接啟動 Column drag。

```text
Sortable local state
→ acquire lock
→ lock 成功才允許持久化 move
→ commit 後重新取得 snapshot
```

前端狀態：

```ts
type ProjectDragState =
  | { status: 'IDLE' }
  | { status: 'ACQUIRING' }
  | {
      status: 'ACTIVE';
      lockToken: string;
      kind: 'COLUMN' | 'CARD';
      resourceId: string;
      expiresAt: string;
    }
  | {
      status: 'LOCKED_BY_OTHER';
      holderName: string;
      expiresAt: string;
    };
```

- 自己持有 lock：可顯示 `chosen`、`ghost`、`dragging` 視覺 class。
- 他人持有 lock：Column／Card drag handle disabled，但 Card 一般編輯維持可用。
- client 同時 acquire 時，Redis 只有一人成功；失敗者必須還原 Sortable 的本機順序並顯示提示。
- Socket 斷線、lock 遺失或收到 revision conflict：停止本機拖曳並重新取得 snapshot。

## Column move command

第一版仍可用 HTTP 做持久化寫入：

```text
PATCH /board/moveColumn
```

```ts
type MoveBoardColumnRequest = {
  projectId: string;
  columnId: string;
  // 移動後左側／前一個相鄰欄位。
  beforeColumnId: string | null;
  // 移動後右側／下一個相鄰欄位。
  afterColumnId: string | null;
  expectedBoardRevision: string;
  lockToken: string;
};
```

後端處理順序：

1. 從 Session 取得 userId，驗證有效 Project OWNER／EDITOR membership。
2. 驗證 request 的 `lockToken` 與 Redis active Project drag session 相符，且 `kind= COLUMN`。
3. 驗證目標 Column、前後相鄰 Column 都屬於同一個未封存 Project。
4. 在 PostgreSQL transaction 內確認 `expectedBoardRevision`。
5. 計算或重排 `position`，更新 Column 並遞增 `boardRevision`。
6. transaction commit 後 release Redis lock。
7. 廣播權威 `boardColumn:moved` event；第一版 client 可直接重新 GET snapshot。

Redis 和 PostgreSQL 沒有跨系統 transaction；所以即使取得 Redis lock，資料庫仍必須驗證 `boardRevision`，以處理 lock 過期、網路重送或非預期並行。

## Snapshot

`GET /board/:projectId` 最終至少要回傳：

```ts
{
  boardRevision: string;
  columns: BoardColumnSnapshot[];
}
```

Columns 依 `position ASC, id ASC` 排序。Card model 完成後，Column 內再以 `position ASC, id ASC` 回傳 Cards。重連、lock 遺失、move 失敗或 revision conflict 都以此 snapshot 校正。

## Card move（後續）

Card drag 使用同一把 Project drag session，但持久化 command 改為：

```ts
type MoveCardRequest = {
  projectId: string;
  cardId: string;
  targetColumnId: string;
  beforeCardId: string | null;
  afterCardId: string | null;
  expectedBoardRevision: string;
  expectedCardVersion: number;
  lockToken: string;
};
```

Card 內容編輯只使用 `expectedCardVersion`；Column 排序造成的 `boardRevision` 改變不應阻擋單純內容儲存。

## 錯誤與恢復

| 情況 | Backend 結果 | 前端行為 |
| --- | --- | --- |
| Project 有其他 active drag session | `PROJECT_DRAG_LOCKED` | 取消／還原 Sortable，提示目前有人調整看板 |
| lock token 不存在、過期或不屬於本人 | `LOCK_LOST` | 停止拖曳並重新 GET snapshot |
| board revision 不符 | `VERSION_CONFLICT` | 重新 GET snapshot，不自行猜測排序 |
| 權限、scope 或封存狀態不符 | `FORBIDDEN`／`RESOURCE_NOT_FOUND` | 停止操作並顯示錯誤 |
| Socket 斷線 | local drag state 清除 | 重連後重新 GET snapshot |

## v1 驗收條件

1. A 拖 Column 時，B 無法拖任意 Column 或 Card。
2. A 拖 Card 時，B 無法拖任意 Column 或 Card。
3. A 編輯 Card 內容時，B 仍可拖 Column 或 Card。
4. 同時 acquire 時只有一位使用者成功。
5. A 正常結束、取消或斷線後，B 可取得 lock；非正常斷線最晚 15 秒可重新取得。
6. lock room event 漏收時，Server acquire 仍正確拒絕第二位使用者。
7. move 成功後所有 client 最終以相同 snapshot 與 board revision 收斂。
8. move 失敗、lock 遺失或 revision conflict 時，client 不保留猜測的本機排序。
