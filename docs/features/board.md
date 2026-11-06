# Board 與 Card 規格

日期：2026-10-30。狀態：**階段 A 完成；A+、B 已確認，實作中**；階段 C、D 為提案（§7、§8）。

本文取代 2026-09 撰寫、彼此衝突的四份舊規格（Board API 與 WebSocket、看板拖曳與滑動、Project 拖曳與 Redis Lock、Kanban Domain）。規則由使用者以 grill 逐項確認（Q1–Q19）。舊規格仍有用的內容已併入本文（§4.5、§6.1、§8），2026-10-30 刪除，需要時可從 git 歷史查看。

## 1. 名詞與邊界

- 資料階層：`Workspace → Project → BoardColumn → Card`。
- 不建立 `Board` model。「看板」是 Project 的畫面，Project 是 aggregate root。
- PostgreSQL 是唯一的資料來源；前端 store、Socket room、Redis 都不是。

## 2. 交付階段（Q1）

| 階段 | 內容 | 完成後 |
| --- | --- | --- |
| **A** | Card 新增、編輯、封存；看板一次載入欄位與卡片 | 單人可正常使用 |
| A+ | Card 類別（`CardCategory`）（Q2：緊接 A 之後，不等 C、D；規格 §4.5） | 卡片顯示類別 |
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
- **修改卡片時，VIEWER 也回 404**（2026-11-02 決定）：權限以單一查詢檢查「OWNER 或 EDITOR」，分不出 VIEWER 與非成員。前端不對 VIEWER 顯示修改入口，正常使用不會遇到。與 `addColumn` 對 VIEWER 回 403 的既有行為不同。
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

### 4.5 類別（A+，2026-11-03 grill Q1–Q21 確認）

> **標籤已取消（2026-11-05 決定）**：原本 A+2 要做多選、沒有顏色的標籤（`CardLabel`）。但看板沒有篩選或搜尋，標籤只是卡片上的一行文字，分類已經由類別處理，所以取消。之後若要做看板篩選，再重新討論是否需要標籤。

**範圍**
- 在卡片 Dialog 內直接選取或建立，不做管理頁面（Q3）；A+ 不做刪除、改名、改色，沒有卡片使用的類別仍留在選單裡（Q7）。

**資料（Q2、Q4、Q5、Q19、Q20）**

| Model | 欄位 | 說明 |
| --- | --- | --- |
| `CardCategory` | id, projectId, name, normalizedName, colorKey | 一張卡片最多一個類別；`Card.categoryId` 可為 null，`onDelete: SetNull` |

- 名稱 trim 後 1–20 字；`normalizedName` 為 trim 後轉小寫，`(projectId, normalizedName)` unique，所以 `Backend` 與 `backend` 視為同一個。
- 類別對 Project `onDelete: Cascade`（與 BoardColumn 相同）；卡片封存時保留關聯。
- 類別色票為 14 色，放在 contracts：`CARD_CATEGORY_COLOR_KEYS`／`CardCategoryColorKey`（與 `BOARD_COLUMN_COLOR_KEYS` 同寫法），DTO 以 `IsIn` 驗證，資料庫存字串。

**上限（Q13）**：每個專案最多 50 個類別；超過回 409 / `CardCategoryLimitExceeded = 7002`。

**權限與版本（Q8、Q14）**
- 建立類別、修改卡片的類別：只有 OWNER、EDITOR，VIEWER 回 404。
- 修改卡片的類別是「編輯卡片」：帶 `expectedVersion`，`version` +1、`boardRevision` +1，不符回 409 / 7001。
- 新建立類別時 `boardRevision` +1；名稱已存在、直接沿用時不變。

**排序（Q15）**：選單依 `normalizedName` 排序。

**前端（Q16、Q21）**
- 看板卡片：類別為標題上方的色塊 chip；沒有時不顯示。
- 類別：可輸入篩選的下拉選單；名稱不存在時最下面出現「建立「xxx」」，展開色票，預設第一個尚未使用的顏色。
- VIEWER 只看到純文字。細節以 A+ 設計稿為準（設計稿中的標籤畫面不採用）。

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

A+ 追加（§4.5，Q9–Q12、Q18）：

| 動作 | API | Body | 回應 |
| --- | --- | --- | --- |
| 建立類別 | `POST /board/addCategory` | `{ projectId, name, colorKey }` | 類別、`boardRevision`；名稱已存在時回傳既有的那一筆 |

- `addCard`／`updateCard` 增加可選的 `categoryId`，只接收 id。在 Dialog 輸入新名稱時先呼叫建立 API 取得 id，存卡片時再送出；使用者取消時已建立的類別保留（Q7）。
- `updateCard`：`categoryId` 沒送＝不改、`null`＝移除。
- `categoryId` 必須屬於卡片所在專案，否則（含不存在）回 404 / ResourceNotFound。
- `BoardSnapshot` 最外層加 `categories: [{ id, name, colorKey }]`；每張卡片帶 `categoryId: string | null`。
- 修改類 API 一律回傳完整資料與 `boardRevision`，前端據此更新畫面（§6）。

### 5.3 版本衝突（Q9、Q17）

- 編輯與封存帶 `expectedVersion`；與資料庫不符時回 **409**，不覆蓋別人的修改。編輯成功時 `version` +1。
- 版本衝突回 **409 / CardVersionConflict (7001)**（2026-11-03 決定）；Board 相關錯誤碼使用 7xxx。
- 編輯時 `description` 分三種情況（2026-11-03 決定）：沒有送這個欄位＝不改；空字串或只有空白＝清空（存成 null）；有內容＝更新。標題與描述都沒送時回 400，避免什麼都沒改卻讓 `version` +1。
- **移動不檢查、也不改變 `version`**：拖曳不應讓正在編輯內容的人收到 409。
- 移動以 `afterCardId`（`null` 代表放在最上面）讓後端計算 position（Q15）。`afterCardId` 已不在目標欄位（被移走或封存）時回 409 / `CardMoveConflict (7003)`（2026-11-05 決定；7003 原本預留給已取消的標籤上限，未曾上線）。`afterCardId` 等於 `cardId` 回 400；目標欄位不存在、已封存或屬於別的專案回 404。移到原本的位置不特別判斷，照常寫入、`boardRevision` +1。

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
| A-0 | `GET /board/:projectId` 讀取權限 | ✅ 2026-10-30：`project.findFirst` 一次查出權限與欄位，無權限回 404 / 3001；service 3 個單元測試，Bruno 新增 `GetBoardColumnsNotMember`；2026-11-02 使用者以 Bruno 驗證通過 |
| A-1 | `Card` schema 與 migration | ✅ 2026-11-02：migration `20261102070348_add_card_model`；`description` 為 `Text`（5000 字上限放在 DTO）、欄位刪除時 cascade、建立者 restrict、索引 `column_id, archived_at, position, id` |
| A-2 | 看板回傳 `{ boardRevision, columns[].cards }`（含前端改用新格式） | ✅ 2026-11-02：contracts `BoardSnapshot`／`BoardColumnSnapshot`／`BoardCardSnapshot`；repository 一次查出權限、`boardRevision`、欄位與卡片（各自 `select` 需要的欄位）；service 轉字串與 ISO 日期；前端 `getBoardSnapshotApi`、`BoardCard` 先只顯示標題。後端 5 個、前端 2 個測試；2026-11-02 使用者以 Bruno 與瀏覽器驗證通過 |
| A-3 | `POST /board/addCard` | ✅ 2026-11-03：`AddCardDto`（title trim 1–200、description 最多 5000）、`findEditableColumn` 以單一查詢檢查 OWNER／EDITOR 與封存狀態（VIEWER 也回 404）、transaction 內先遞增 revision 再查最大 position 並建立卡片、空白描述存成 null；repository 以 `CreateCardData` 與 API request 分開。DTO 10 個、service 6 個測試；Bruno `AddCard`、`AddCardColumnNotFound`；使用者以 Bruno 驗證通過 |
| A-4 | `PATCH /board/updateCard`（`expectedVersion`） | ✅ 2026-11-03：`CardVersionConflict = 7001`、`UpdateCardRequest`、`UpdateCardDto`；`findEditableCard`（卡片 → 欄位 → 專案）；`updateCardContent` 以 `updateMany where { id, version: expectedVersion }` 在同一個 SQL 比對版本並更新，0 筆回 409（transaction rollback，revision 不增加）；標題與描述都沒送回 400；描述 undefined＝不改、空字串＝null。DTO 13 個、service 8 個測試；Bruno `UpdateCard`、`UpdateCardVersionConflict`；使用者以 Bruno 驗證通過 |
| A-5 | `PATCH /board/archiveCard` | ✅ 2026-11-03：`ArchiveCardRequest`／`ArchiveCardResult`、`ArchiveCardDto`；`findEditableCard` 多帶 `columnId`；`archiveCard` 以 `updateMany where { id, version, archivedAt: null }` 設定 `archivedAt` 並讓 version +1，0 筆回 409；回傳 `{ cardId, columnId, boardRevision }`，不回傳卡片內容。DTO 6 個、service 4 個測試；Bruno `ArchiveCard`、`ArchiveCardAgain`；2026-11-03 以 curl 對本機後端跑完整流程驗證：新增 → 編輯 → 409（revision 不變）→ 都沒送 400 → 清空描述 → 封存 200 → 重複封存 404 → 看板上不再出現 |
| A-6 | 前端：新增、編輯、封存卡片（依設計稿） | ✅ 2026-11-03：`BoardSnapshot` 加 `currentUserRole`（repository 只 select 目前使用者的 membership），VIEWER 不顯示「＋ 新增卡片」、卡片詳情為唯讀；`DialogAddCard` 帶入目標欄位；`DialogCardDetail` 只送有變更的欄位與 `expectedVersion`，409 顯示衝突提示並停用儲存、「重新載入」後以最新版本重填，404 關閉並重新載入看板；封存經 AlertDialog 確認；成功後直接套用回傳結果與 `boardRevision`（Q14），不重新 GET。後端 1 個、前端 18 個測試；2026-11-03 使用者以瀏覽器驗證通過 |
| A+1-0 | 設計稿：類別選單（含建立與色票）、卡片上的類別 | ✅ 2026-11-03：`design/card-dialog-phase-a-plus.svg`、`card-taxonomy-states-phase-a-plus.svg`；Figma plugin v17 已產生並由使用者確認（其中的標籤畫面因標籤取消而不採用） |
| A+1-1 | `CardCategory` schema 與 migration；contracts 色票 | ✅ 2026-11-03：migration `20261103072139_add_card_category`（`card_categories`、`(project_id, normalized_name)` unique、`cards.category_id` SetNull＋索引）；contracts `CARD_CATEGORY_COLOR_KEYS`／`CardCategoryColorKey`，前端 `types/board.ts` 刪除、`cardCategoryColors.ts` 改由 contracts 匯入 |
| A+1-2 | `POST /board/addCategory` | ✅ 2026-11-04：contracts `CardCategorySnapshot`／`AddCategoryRequest`／`AddCategoryResult`、`CardCategoryLimitExceeded = 7002`；`AddCategoryDto`（name trim 1–20、colorKey `IsIn`）；repository `findEditableProject`、`findCategoryByNormalizedName`（複合鍵 `projectId_normalizedName`）、`getBoardRevision`、`countCategories`、`createCategory`（`CreateCategoryData`）；service 先查同名（沿用時 revision 不變、不檢查上限），新名稱才 +1（鎖 Project）→ 數量 ≥ 50 回 409 → 建立。DTO 11 個、service 6 個測試；Bruno `AddCategory`、`AddCategoryExisting`、`AddCategoryInvalidColor`；使用者以 Bruno 驗證通過 |
| A+1-3 | `addCard`／`updateCard`／看板回傳支援類別 | ✅ 2026-11-04（後端）：contracts `BoardCardSnapshot.categoryId`、`BoardSnapshot.categories`、`AddCardRequest`／`UpdateCardRequest.categoryId`；DTO `IsOptional`＋`IsUUID`（null 原樣傳到 service 代表移除）；repository `CARD_SNAPSHOT_SELECT` 加 `categoryId`、`getAllBoardColumn` 選 `cardCategories`（3 欄、依 `normalizedName`）、`findCategoryInProject`、`CreateCardData`／`UpdateCardContentData.categoryId`；service `assertCategoryInProject`（不同專案或不存在 404，類別不能刪除所以在 transaction 外檢查）、`updateCard` 只送 `categoryId` 也算修改。DTO 7 個、service 8 個測試；Bruno `AddCardWithCategory`、`UpdateCardRemoveCategory`，`GetBoardColumns` 檢查 `categories`。2026-11-04 以 seed 資料跑 25 項 API 端對端檢查全部通過（含別專案類別 404、VIEWER／非成員 404、null 移除、過期 version 409） |
| A+1-4 | 前端：類別選單與卡片 chip | ✅ 2026-11-04：`CategoryChip`（14 色，未知色票退回 slate）、`BoardCard` 標題上方顯示類別、`ProjectView` 以 `categoryId` 對照 `categories`；`CategorySelect`（展開式面板：篩選不分大小寫、「不設定類別」送 null、名稱不存在時「建立」＋14 色預設第一個未使用顏色、7002／400 錯誤顯示在面板內）接到新增與詳情 Dialog，只送有變更的 `categoryId`；VIEWER 以 chip 或「沒有類別」顯示；建立後 `ProjectView` 依名稱插入並更新 `boardRevision`。前端 17 個新測試；以 Chrome 實際操作驗證：看板 chip、新增卡片時建立新類別（預設第一個未使用顏色）、詳情改類別與「不設定類別」、重新整理後保留、VIEWER 唯讀，console 無錯誤 |
| B-1 | `PATCH /board/moveCard`（position 計算、重新編號） | ✅ 2026-11-06：contracts `MoveCardRequest`、`CardMoveConflict = 7003`；`MoveCardDto`（`afterCardId` 必須明確送 UUID 或 null）；repository `findCardPositionInColumn`、`findNextCardPosition`（排除正在移動的卡片）、`moveCard`（不動 version）；service：自己後面 400 → 卡片與目標欄位權限、同專案 404 → transaction（先 +1 revision 鎖 Project → 查 afterCard 位置，不在目標欄位 409 → 計算 position → 移動，0 筆 404 → snapshot）。DTO 7 個、service 18 個測試；Bruno `MoveCard`、`MoveCardSameColumn`、`MoveCardAfterArchived`、`MoveCardAfterSelf`。使用者實作 service `calculateMovePosition`（三種情況；重新編號後重新查 after 與下一張，after 卡片查不到時丟 500，因為正常流程不會發生）與 repository `renumberColumnCards`（一句 `UPDATE ... FROM` 子查詢 `ROW_NUMBER() OVER (ORDER BY position, id) * 1024`，參數 `::uuid`，`tx` 必填）。2026-11-06 驗證：board 測試 116 通過／1 skipped（含 11 個 position 驗收測試）；在開發 DB 的 transaction 內把 15 張卡片設成相鄰 position 後呼叫 `renumberColumnCards`，未封存卡片依序變成 1024…13312，移動中與已封存卡片不變，最後 rollback；Bruno Login→Workspaces→Project→Board 30 個請求、42 個測試全部通過 |
| B-2 | 前端拖曳（把手、手機長按、失敗重新載入） | ⬜ |
