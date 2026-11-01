# Board 與 Card 規格

日期：2026-10-30。狀態：**階段 A、B 已確認，實作中**；階段 C、D 為提案（§7、§8）。

本文取代 2026-09 撰寫、彼此衝突的四份舊規格（Board API 與 WebSocket、看板拖曳與滑動、Project 拖曳與 Redis Lock、Kanban Domain）。規則由使用者以 grill 逐項確認（Q1–Q19）。舊規格仍有用的內容已併入本文（§4.5、§6.1、§8），2026-10-30 刪除，需要時可從 git 歷史查看。

## 1. 名詞與邊界

- 資料階層：`Workspace → Project → BoardColumn → Card`。
- 不建立 `Board` model。「看板」是 Project 的畫面，Project 是 aggregate root。
- PostgreSQL 是唯一的資料來源；前端 store、Socket room、Redis 都不是。

## 2. 交付階段（Q1）

| 階段 | 內容 | 完成後 |
| --- | --- | --- |
| **A** | Card 新增、編輯、封存；看板一次載入欄位與卡片 | 單人可正常使用 |
| A+ | Card 類別（`CardCategory`）與標籤（`CardLabel`）（Q2：緊接 A 之後，不等 C、D） | 卡片顯示類別與標籤 |
| **B** | 拖曳卡片（同欄、跨欄）並存檔 | 重新整理後順序保留 |
| C | 多人即時同步 | 看到別人的修改 |
| D | 兩人同時拖曳的衝突處理 | 協作時不亂 |
| 之後 | 欄位拖曳、Checklist、到期日、成員、活動紀錄、還原封存 | — |

## 3. 權限（Q7）

看板與卡片**沒有自己的權限**，一律由專案角色（`ProjectMember.role`）決定：

| 角色 | 讀取看板 | 新增、編輯、封存、移動卡片 |
| --- | --- | --- |
| OWNER | ✅ | ✅ |
| EDITOR | ✅ | ✅ |
| VIEWER | ✅ | ❌ |

- Project 或 Workspace 已封存時，任何人都不能修改。
- 非成員、Project／Workspace 已封存、資源不存在，一律回 **404 / ResourceNotFound (3001)**，不透露資源是否存在。
- 讀取權限以 `project.findFirst` 的 `where`（`archivedAt: null`、`workspace.archivedAt: null`、`members.some.userId`）一次查出（2026-10-30 已實作於 `GET /board/:projectId`）。

## 4. 資料模型

### 4.1 BoardColumn（已存在）

`id`、`projectId`、`title`、`colorKey`、`position`、`version`、`archivedAt`、`createdAt`、`updatedAt`。

### 4.2 Card（Q6，待建立）

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `id` | UUID | |
| `columnId` | UUID | 所屬欄位 |
| `title` | VarChar(200) | 必填 |
| `description` | Text，最多 5000 字 | 選填 |
| `position` | Int | §4.3 |
| `version` | Int，預設 1 | 編輯內容時 +1（§5.3） |
| `createdById` | UUID | 建立者 |
| `archivedAt` | DateTime? | 封存時間 |
| `createdAt`、`updatedAt` | DateTime | |

- **不存 `projectId`**：載入看板時卡片掛在欄位底下查詢；編輯時以 `card → column → project` 關聯條件檢查權限。只有一個資料來源，不會出現卡片與欄位的專案不一致。
- 只能封存，不能刪除（Q8）；階段 A 不做還原。

### 4.3 排序（Q5、Q16）

- `position` 為間隔 1024 的整數，與欄位相同；新卡片為該欄最大值 + 1024，空欄從 1024 開始（Q12）。
- 插入兩張卡片之間時取中間值；兩者相鄰（沒有整數可用）時，在同一個 transaction 裡把該欄全部卡片重新編號為 1024、2048……後再插入。

### 4.4 boardRevision（Q11）

`Project.boardRevision`（已存在）在每次修改欄位或卡片時，於**同一個 transaction** 內 +1，並回傳給前端。階段 C 用它判斷是否漏掉更新。

### 4.5 類別與標籤（A+，尚未 grill）

來自舊規格的方向，開始 A+ 之前再確認：

- `CardCategory`、`CardLabel` 都直接帶 `projectId`，在同一個專案內共用；`projectId + 正規化後的名稱` 不可重複。
- 一張卡片最多一個類別，可以有多個標籤（設計稿 `create-card-dialog.svg` 也是如此）。
- 類別、標籤必須與卡片所在欄位屬於同一個專案，由 service 驗證。

## 5. API

### 5.1 讀取看板（Q3）

`GET /board/:projectId`，沿用現有路徑，回傳改為：

```ts
{
  boardRevision: string; // BigInt 以字串傳輸
  columns: Array<{
    id; title; colorKey; position;
    cards: Array<{ id; columnId; title; description; position; version; createdAt; updatedAt }>;
  }>;
}
```

- 只包含未封存的欄位與卡片，依 `position` 排序。
- 已封存欄位裡的卡片不顯示，也不跟著封存（Q13）。

### 5.2 卡片修改（Q10）

沿用 board 模組的動詞命名：

| 動作 | API | Body | 回應 |
| --- | --- | --- | --- |
| 新增 | `POST /board/addCard` | `{ columnId, title, description? }` | 完整卡片、`boardRevision` |
| 編輯 | `PATCH /board/updateCard` | `{ cardId, title?, description?, expectedVersion }` | 完整卡片、`boardRevision` |
| 封存 | `PATCH /board/archiveCard` | `{ cardId, expectedVersion }` | `cardId`、`columnId`、`boardRevision` |
| 移動（B） | `PATCH /board/moveCard` | `{ cardId, toColumnId, afterCardId }` | 完整卡片、`boardRevision` |

- 對已封存的欄位新增卡片：404。
- 修改類 API 一律回傳完整資料與 `boardRevision`，前端據此更新畫面（§6）。

### 5.3 版本衝突（Q9、Q17）

- 編輯與封存帶 `expectedVersion`；與資料庫不符時回 **409**，不覆蓋別人的修改。編輯成功時 `version` +1。
- **移動不檢查、也不改變 `version`**：拖曳不應讓正在編輯內容的人收到 409。
- 移動以 `afterCardId`（`null` 代表放在最上面）讓後端計算 position（Q15）。`afterCardId` 已不在目標欄位（被移走或封存）時回 409。

## 6. 前端更新策略（Q14、Q18、Q19）

| 情況 | 做法 |
| --- | --- |
| 自己的修改成功 | 以 API 回應更新畫面（`applyCard`），不重新載入 |
| 拖曳 | 放開時先更新畫面，再呼叫 API |
| 409、載入失敗、拖曳 API 失敗 | 重新載入整個看板（`reloadBoard`） |

- 不在每次修改後重新 GET：看板資料量大、連續操作時較晚回來的 GET 會蓋掉較新的狀態、整個重新渲染會重設捲動與輸入狀態。
- 拖曳：使用已安裝的 `vue-draggable-plus`；只能按住**把手**拖曳，點卡片其他位置開啟詳情；手機長按把手約 200ms 才開始拖曳；依 `design/board-drag-states.svg` 實作。

### 6.1 拖曳與捲動的實作細節（B-2）

來自舊規格，實作 B-2 時遵循：

- **看板水平捲動**：外層 `overflow-x-auto overscroll-x-contain`，內層 `flex min-w-max`，每個欄位 `w-72 shrink-0`。欄位很多時一樣水平捲動，不換行、不縮小欄位。**不要**加 `touch-pan-x`，它會干擾垂直捲動與拖曳套件的觸控事件。
- **觸控與滑鼠**：手指在卡片內容短按是開啟卡片，在看板上左右滑動是原生捲動，按住把手約 220ms 才開始拖曳；滑鼠按住把手立即開始。設定方向為 `handle: '.card-drag-handle'`、`delay: 220`、`delayOnTouchOnly: true`、`group: 'board-cards'`，實際屬性名稱實作時依套件文件查證。
- **邊緣自動捲動**：同一欄內接近上下邊緣時自動垂直捲動。手機拖到看板左右邊緣自動跨欄最難做好，可以不在 B-2 完成；做不好時寧可讓使用者拖到看得到的欄位，**不可以**為了方便改成整張卡片都能拖。
- **拖曳不能是唯一的移動方式**：卡片詳情要有「移動至…」選單（`card-detail.svg` 已有此項）選擇目標欄位；把手要有可讀的 accessible name；錯誤與衝突不能只用顏色表示；尊重 `prefers-reduced-motion`。
- **斷線**：拖曳中斷線就停止拖曳，重新連線後重新載入看板，不假設斷線前的順序仍然有效。

## 7. 階段 C 提案（尚未確認，進行 C 之前再 grill）

- （Q20）進入 `ProjectView` 時加入 Socket room `project:{projectId}`，伺服器檢查是否為專案成員（含 VIEWER），離開頁面時退出。
- （Q21）修改一律走 HTTP；transaction **完成後**才透過 Socket 廣播給 project room。不採用 Socket 指令＋ack。
- （Q22）廣播給 room 內所有人（含發送者），前端忽略 `boardRevision` 小於或等於目前版本的事件。事件：`board:cardCreated`、`board:cardUpdated`、`board:cardMoved`、`board:cardArchived`（`cardId`、`columnId`、`boardRevision`）、`board:columnCreated`。
- （Q23）收到的 `boardRevision` 大於目前 +1（漏掉更新），或 Socket 斷線重連時，重新載入整個看板。

## 8. 階段 D（未討論）

兩人同時拖曳的體驗改善。B 的 `afterCardId` 已能偵測衝突並回 409，D 不需更動 A、B 的 API。舊規格提過兩個方案，留待 D 時比較：

| 方案 | 做法 | 取捨 |
| --- | --- | --- |
| 鎖整個專案的拖曳 | 開始拖曳時以 Redis lease lock（有 TTL）取得 `lock:projectDragSession:{projectId}`，有人在拖時其他人不能拖；一般編輯不受影響 | 最不會亂，但多人時常被擋 |
| 只鎖被拖的卡片（soft lock） | 拖曳中的卡片在別人畫面上顯示「某人正在移動」，只是提示，正確性仍靠 409 | 體驗較好，但要處理 TTL、斷線釋放 |

另外，C、D 若改成 Socket 指令，舊規格還提過 command ID 與 idempotency（避免重試造成重複移動）；目前 C 的提案是走 HTTP，暫不需要。

## 9. 實作步驟

| 步驟 | 內容 | 狀態 |
| --- | --- | --- |
| A-0 | `GET /board/:projectId` 讀取權限 | ✅ 2026-10-30：`project.findFirst` 一次查出權限與欄位，無權限回 404 / 3001；service 3 個單元測試，Bruno 新增 `GetBoardColumnsNotMember`（待使用者驗證） |
| A-1 | `Card` schema 與 migration | ⬜ |
| A-2 | 看板回傳 `{ boardRevision, columns[].cards }`（含前端改用新格式） | ⬜ |
| A-3 | `POST /board/addCard` | ⬜ |
| A-4 | `PATCH /board/updateCard`（`expectedVersion`） | ⬜ |
| A-5 | `PATCH /board/archiveCard` | ⬜ |
| A-6 | 前端：新增、編輯、封存卡片（依設計稿） | ⬜ |
| A+ | 類別與標籤 | ⬜ |
| B-1 | `PATCH /board/moveCard`（position 計算、重新編號） | ⬜ |
| B-2 | 前端拖曳（把手、手機長按、失敗重新載入） | ⬜ |
