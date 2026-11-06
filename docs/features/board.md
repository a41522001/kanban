# Board 與 Card 規格

日期：2026-10-30。狀態：**階段 A、A+（類別）、B 完成**（2026-11-06）；階段 C 已確認、待實作（§7），D 未討論（§8）。

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
- **斷線**：不中斷拖曳（存檔走 HTTP），顯示「即時同步已中斷」，重新連線後重新載入看板，不假設斷線前的順序仍然有效（2026-11-06 C grill Q11 修改）。

## 7. 階段 C：多人即時同步（2026-11-06 grill Q1–Q12 確認）

### 7.1 設計原則：正確性靠 PostgreSQL，Socket 只負責通知

| 層 | 負責 | 出錯時 |
| --- | --- | --- |
| PostgreSQL transaction | 資料正確。`incrementBoardRevision` 以 UPDATE 鎖住 Project 列（悲觀鎖），同一專案的修改依序執行、revision 連續且唯一；`expectedVersion`、`afterCardId` 檢查（樂觀鎖）擋下根據舊畫面送出的修改（409） | — |
| Socket 廣播 | 讓其他人較快看到變更 | 畫面暫時過時 |
| 前端 `boardRevision` 檢查 | 發現漏號就重新載入 | 多載入一次 |

Socket 事件遺失、亂序或斷線都不會讓資料出錯。因此 C 不需要 Redis、RabbitMQ 或事件重播（2026-11-06 討論）：Redis adapter 留給多 instance，Redis lease lock 留給 D，事件重播留到重新載入慢到可感覺時再評估。

### 7.2 寫入與廣播（Q1–Q4）

- （Q2）修改一律走 HTTP；`BoardService` 在 `$transaction` 成功回傳**之後**才廣播到 `project:{projectId}`，HTTP 回應不變。不採用 Socket 指令＋ack。
- （Q1）事件帶完整資料，格式與 HTTP 回應相同，前端沿用套用 API 回應的函式；只有漏號或重連時重新載入整個看板。
- （Q3）**`boardRevision` +1 就一定要發事件**，否則其他人會誤判漏號。目前 6 種：

| 修改 | 事件 | payload |
| --- | --- | --- |
| `addColumn` | `board:columnCreated` | 新欄位、`boardRevision` |
| `addCard` | `board:cardCreated` | 完整卡片、`boardRevision` |
| `updateCard` | `board:cardUpdated` | 完整卡片、`boardRevision` |
| `archiveCard` | `board:cardArchived` | `cardId`、`columnId`、`boardRevision` |
| `moveCard` | `board:cardMoved` | 完整卡片、`boardRevision` |
| `addCategory`（新名稱） | `board:categoryCreated` | 類別、`boardRevision`；沿用既有名稱時 revision 不變，不發事件 |

之後新增會讓 revision +1 的修改（例如 `moveColumn`）時，同時新增事件。

- （Q4）廣播給 room 內所有人（含發送者）。發送者會同時收到 HTTP 回應與事件，先到的套用，後到的因 `boardRevision` 小於或等於目前值而忽略。不在請求中傳 socket id；同一個人的其他分頁自然收到更新。

### 7.3 前端套用（Q5–Q7、Q9、Q11）

- （Q5、Q6）看板載入中、自己拖曳中（`@start` 到自己的 `moveCard` 成功或失敗）收到的事件放入同一個佇列。結束後丟棄 `boardRevision` 小於或等於目前值的事件，其餘依序走正常流程。
- 正常流程：`boardRevision` 小於或等於目前值 → 忽略；等於目前 +1 → 套用；大於目前 +1 → 重新載入整個看板。
- （Q9）兩個請求幾乎同時 commit 時，廣播可能亂序到達（DB commit 有序，但 commit 後各自的 async 流程誰先廣播不一定）。先收到較大的號碼時直接重新載入，較晚到的舊事件被忽略；若實際使用時經常發生，再改為短暫等待缺號。
- （Q7）卡片詳情開著時：

| 情況 | 處理 |
| --- | --- |
| 別人編輯（事件的 `version` 大於對話框開啟時），自己尚未修改 | 直接換成最新內容 |
| 別人編輯，自己已修改 | 顯示現有的衝突提示（「這張卡片已被其他成員修改」＋「重新載入」），不覆蓋輸入中的內容 |
| 別人封存 | 關閉對話框，toast「這張卡片已被封存」 |
| 別人移動（`version` 不變） | 只更新「目前位於…」，不算衝突 |

- （Q11）Socket 斷線時不中斷拖曳（存檔走 HTTP，與 Socket 無關），看板上方顯示「即時同步已中斷，正在重新連線…」（依 `isConnected`），不停用任何操作；重連後提示消失並重新載入看板。

### 7.4 Project room（Q8）

完全沿用 Workspace room（[Socket.IO 驗證](../architecture/socketio-auth.md) §5、§6）：

- 前端 `services/socket.ts` 新增 `emitProjectInto`／`emitProjectLeave`，記住 `currentProjectId`，每次 `connect` 補送、`disconnect()` 清除。`ProjectView` 在 `onMounted` 加入、`onUnmounted` 離開，以 `onReconnected` 重新載入看板。
- 後端 `project:into` 先寫入 `socket.data.targetProjectId` 再檢查權限，檢查完 id 仍相同才 join；`project:leave` 比對 id 後才清除。
- 加入條件：Project 的有效成員（含 VIEWER），Project 與 Workspace 皆未封存；不符時記 warn log，不通知前端。
- 一條 Socket 同時只在一個 project room。

### 7.5 不在範圍內（Q10）

- 成員被移除或改角色後移出 room、更新權限：目前沒有這些功能，屆時處理。在那之前被移除的人仍會收到事件，但 HTTP 修改會被拒絕。
- 多個後端 instance：目前使用 Socket.IO 預設 adapter，廣播只送到同一個 instance；正式環境目前只有一個後端 container。擴充時改用 Redis adapter，`BoardService` 不需修改。
- 後端在 commit 之後、廣播之前當機，事件會遺失；其他人的看板停在舊狀態，直到下一個事件（偵測到漏號）或重新整理。發生機率低、影響是暫時不同步，暫不處理；需要時以 PostgreSQL transactional outbox 解決。

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
| B-2 | 前端拖曳（把手、手機長按、失敗重新載入） | ✅ 2026-11-06：`services/board.ts` `moveCardApi`；`ProjectView` 每欄卡片改為 `VueDraggable`（`group: 'board-cards'`、`handle: '.board__card-handle'`、`delay: 220`、`delayOnTouchOnly`、VIEWER `disabled`；`prefers-reduced-motion` 時 animation 0），卡片右上角 44×44 把手（accessible name「拖曳卡片「標題」」，VIEWER 不顯示）；放開時套件已更新 `column.cards`，`end` 以上一張卡片為 `afterCardId`（最上面為 null）呼叫 API，位置沒變不呼叫；成功時以回應取代卡片、`boardRevision` 取較大值，任何失敗都提示並 `reloadBoard`（7003 提示「看板已被其他人變更」）。原位置虛線 placeholder、滑過的欄位綠底外框、空欄位可放入。卡片詳情加「移動至…」選單（移到該欄最下面，目前欄位停用，VIEWER 不顯示），與拖曳共用存檔流程。純函式放在 `views/projectView/cardMove.ts`。前端 14 個新測試（`cardMove` 9、「移動至…」4、service 1）。順手修正：`DialogContent`／`AlertDialogContent` 經 portal 渲染，scoped 的 `.card-dialog`、`.card-dialog--detail`、`.card-dialog__confirm` 從未生效（對話框沒有 `max-h`，矮視窗時按鈕在畫面外），改為 `:global(...)`。以 Chrome 驗證：跨欄放最上面、拖進空欄、同欄換順序、「移動至…」，畫面與 DB position 一致；背景封存 after 卡片後拖曳 → 409 提示並重新載入；VIEWER 無把手；651px 高視窗三個對話框都在畫面內。**未完成**：手機長按未在實機測試；拖到看板左右邊緣自動跨欄未做（§6.1 允許）；斷線處理見 C-3 |
| C-1 | project room：contracts `project:into`／`project:leave`；後端依 Workspace 做法（`targetProjectId`）；前端 `socket.ts` emit 與重連補送、`ProjectView` 加入與離開 | ✅ 2026-11-06：contracts `ProjectRoomPayload`；後端 `SocketRepository.findProjectMembership`（`projectMember.findUnique` 複合鍵，只 select 封存欄位；放在 Socket 模組內，因為 `ProjectModule` 已依賴 `SocketModule`，反向 inject 會循環依賴）、`targetProjectId`、`LOG_EVENTS.socketProjectJoinRejected`；前端 `emitProjectInto`／`emitProjectLeave`、`currentProjectId` 重連補送、`disconnect()` 清除；`ProjectView` 以 watch `projectId` 加入與切換（另存 `joinedProjectId`，卸載時 route 可能已變更）、`onReconnected` 重新載入看板。後端 socket spec 17 tests（project 10 個）、前端 socket spec 14 tests（project 4 個）；`nest build` 啟動確認 DI。Chrome：進入看板送出 `project:into`、斷線重連補送並重新 GET 看板一次、返回 Workspace 送出 `project:leave` |
| C-2 | 廣播事件：contracts 6 種事件 payload；`SocketService.emitToProject`；`BoardService` 6 個修改方法於 transaction 後廣播 | 待實作（使用者，測試 Claude） |
| C-3 | 前端套用：事件佇列（載入、拖曳）、漏號重新載入、6 種事件套用、詳情對話框三種情況、斷線提示 | 待實作（Claude） |
