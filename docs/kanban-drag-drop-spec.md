# Flowboard 看板拖曳與滑動規格

> 狀態：規劃中  
> 最後更新：2026-08-20  
> 相關文件：[看板 API 與 WebSocket 規格](./board-api-websocket-spec.md)

本文件定義 Flowboard 看板中「欄位橫向捲動、卡片拖曳、欄位拖曳」以及多人同時操作時的協作規則。它是前端互動規格；資料模型、REST API、Socket.IO 事件的完整欄位仍以 [看板 API 與 WebSocket 規格](./board-api-websocket-spec.md) 為準。

## 1. 目標與非目標

### 1.1 目標

- 在桌機與手機都能瀏覽任意數量的看板欄位。
- 使用者能以明確的拖曳把手移動卡片，避免和手機橫向滑動、點擊卡片衝突。
- 後端是排序與資料版本的唯一真相來源；多人同時移動同一張卡片時，不會覆蓋資料。
- 後續可加入暫時性的 soft lock，讓其他人看見某張卡片或某個欄位正在被移動。
- 非滑鼠／觸控使用者仍有可完成相同工作的替代操作。

### 1.2 非目標

- 不模仿或呼叫 iOS 桌面的原生拖曳 API。網頁只能實作相近的「長按、浮起、排序、邊緣自動捲動」體驗。
- 第一版不做 hard lock，也不會因一位使用者拖曳就鎖住整個 Board 或整個 Column。
- 不以 Swiper 實作看板欄位。看板是可任意長的工作畫布，不是分頁輪播。
- 不在拖曳期間同步游標座標或卡片的每一幀位置；這類高頻事件成本高，且對協作正確性沒有幫助。

## 2. 名詞與核心決策

| 名詞                    | 說明                                                                 |
| ----------------------- | -------------------------------------------------------------------- |
| Board canvas            | 承載多個欄位、可原生水平捲動的區域。                                 |
| Column                  | Board 內的一個可排序欄位，例如「準備開始」。                         |
| Card                    | 欄位內的一張工作卡。                                                 |
| 拖曳把手（drag handle） | 卡片或欄位標題上唯一可啟動拖曳的控制項。                             |
| `position`              | 同一容器內的排序欄位，由伺服器決定並持久化。                         |
| `expectedVersion`       | 使用者開始操作時所看到的 Card／Column 版本，用於偵測並拒絕過期寫入。 |
| soft lock               | 僅作為介面提示的暫時鎖定；不取代版本衝突檢查。                       |

本功能採用下列決策：

1. Board 的欄位採用原生 `overflow-x-auto`，桌機與手機均以水平捲動瀏覽。
2. 卡片只有拖曳把手可啟動拖曳；卡片內容本身保留給點擊與閱讀。
3. 手機上以長按把手才開始拖曳，預設等待約 `200–250ms`。
4. 第一版先完成卡片拖曳；欄位拖曳延後，而且初期只開放桌機操作。
5. 第一個可多人使用的版本先用 `card:move + expectedVersion` 解決正確性；soft lock 是後續的體驗改善。
6. 所有成功排序最後必須以伺服器廣播或重新同步的資料為準，不能以本地暫存狀態作為永久真相。

## 3. 交付階段

| 階段    | 範圍                                         | 是否需要後端／Socket   |
| ------- | -------------------------------------------- | ---------------------- |
| Phase 0 | 靜態欄位、mock 資料、原生水平捲動            | 否                     |
| Phase 1 | 本地卡片排序與同欄拖曳視覺                   | 否                     |
| Phase 2 | 跨欄卡片拖曳、手機長按把手、基本自動捲動     | 否，可先用 mock 模擬   |
| Phase 3 | `card:move`、版本檢查、失敗回復、多人同步    | 是                     |
| Phase 4 | Card soft lock、TTL、斷線清理                | 是；多實例時需要 Redis |
| Phase 5 | Column 拖曳、`column:move`、Column soft lock | 是                     |

Phase 0 不安裝拖曳套件。等卡片版型、資訊密度與手機閱讀方式穩定後，再進入 Phase 1／2。屆時建議評估並使用 `vue-draggable-plus`（底層為 SortableJS）；它能處理 Vue 3 清單綁定、跨清單群組、拖曳把手、觸控延遲與自動捲動。安裝前須確認當前版本文件與專案相容性。

```sh
pnpm --filter frontend add vue-draggable-plus
```

## 4. Board canvas 與水平捲動

### 4.1 結構規則

Board canvas 必須是一條不換行的欄位列，每個 Column 使用固定或最小寬度，並禁止 flex 壓縮。概念結構如下：

```vue
<div class="overflow-x-auto overscroll-x-contain p-4">
  <div class="flex min-w-max gap-4">
    <BoardColumn
      v-for="column in boardColumns"
      :key="column.id"
      class="w-72 shrink-0"
      :column="column"
    />
  </div>
</div>
```

- `overflow-x-auto`：內容寬度超過容器時，瀏覽器提供原生水平捲動；這是功能的必要條件。
- `w-72 shrink-0`：每個欄位維持可讀寬度，不被壓縮成窄條。
- `min-w-max`：讓內層列的寬度可隨所有欄位延伸，避免 flex 容器意外收縮。
- `overscroll-x-contain`：可選增強。到達左右邊界時，盡量不將水平手勢傳給外層或觸發瀏覽器的歷史導覽；它不是捲動功能本身，且應接受部分瀏覽器支援度差異。

目前的 `BoardView.vue` 已具備 `overflow-x-auto`、`overscroll-x-contain`、`w-72`、`shrink-0` 的核心方向。後續實作 `v-for` 時必須補上 `:key="column.id"`，並確保 mock 的每一個 `id` 都唯一；為了測試捲動而複製欄位時，也不可複用 `done` 之類的 ID。

### 4.2 各裝置行為

| 裝置／輸入     | 預期行為                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------- |
| 手機／平板     | 在沒有啟動拖曳時，手指在 Board canvas 上左右滑動，即原生捲動欄位。                            |
| 觸控筆記型電腦 | 觸控板兩指水平移動可捲動；若瀏覽器提供水平捲動手勢，應維持原生行為。                          |
| 滑鼠           | 可拖曳底部捲軸、以 Shift + 滾輪水平捲動，或使用觸控板。日後可增加左右捲動按鈕作為輔助。       |
| 鍵盤           | Canvas 可取得焦點時，應能以可見的底部捲軸或輔助左右按鈕到達所有欄位；拖曳不是唯一的移動方式。 |

不要在 Board canvas 或卡片上加入 `touch-pan-x` 來「強制」水平滑動。它容易妨礙垂直頁面捲動與拖曳函式庫的 Pointer／Touch 事件處理。只要 DOM 寬度溢出、欄位不縮小，瀏覽器已能提供正確的滑動行為。

### 4.3 欄位很多時

桌機欄位很多時仍然使用同一個水平捲動機制，不改成多列換行，也不縮小欄位以塞進螢幕。這樣能維持每欄閱讀寬度、卡片密度與拖放目標的一致性。可以在後續增加：

- 聚焦目前欄位的「捲動到欄位」操作；
- 僅在桌機顯示的左右捲動按鈕；
- 以搜尋或篩選減少可見卡片；
- 在欄位數非常多時，提供欄位導覽清單。

這些是可用性增強，不能取代原生可捲動的 Board canvas。

## 5. 卡片拖曳互動

### 5.1 可開始拖曳的位置

卡片區分三種輸入區域：

| 區域                | 桌機           | 手機                    | 目的                             |
| ------------------- | -------------- | ----------------------- | -------------------------------- |
| 卡片內容            | 點擊開啟詳情   | 短按開啟詳情            | 不誤觸拖曳，保留閱讀與連結操作。 |
| 卡片拖曳把手        | 按住即可拖曳   | 長按約 200–250ms 才拖曳 | 明確表達「此處可移動」。         |
| Board canvas 空白處 | 捲動／點擊空白 | 原生左右滑動            | 瀏覽欄位，不當作卡片拖曳起點。   |

不得讓整張卡片在一碰就進入拖曳狀態。否則手機使用者無法可靠地判斷自己是在開卡片、滑看板，還是在搬移卡片。

拖曳把手應使用真正的 `<button type="button">`，提供可見圖示及文字替代，例如 `aria-label="拖曳：{{ card.title }}"`。把手的可點擊範圍至少應接近 `44 × 44px`，即使視覺圖示較小也一樣。

### 5.2 觸控與滑鼠判定

採取「明確起點 + 長按」規則，而不是根據移動方向猜測意圖：

```text
手指在卡片內容短按
  → 開啟卡片（不啟動拖曳）

手指在 Board canvas 左右滑動
  → 原生水平捲動（不啟動拖曳）

手指在 drag handle 按住 200–250ms
  → 啟動卡片拖曳；直到放下前，DnD 擁有這次 pointer 操作

滑鼠在 drag handle 按住並移動
  → 立即啟動卡片拖曳
```

以 `vue-draggable-plus` 實作時，預期設定概念如下。實際屬性名稱與支援版本必須在安裝時查證：

```ts
const cardDragOptions = {
  group: "board-cards",
  handle: ".card-drag-handle",
  animation: 150,
  delay: 220,
  delayOnTouchOnly: true,
};
```

`delayOnTouchOnly` 的意義是桌機滑鼠不用等待；手機觸控才需要長按。長按時間不宜太短，避免短按開卡片被吃掉；也不宜太長，避免讓人以為畫面沒有反應。初始值以 `220ms` 為準，應在真機上測試後微調。

### 5.3 拖曳中的視覺狀態

拖曳開始後應提供以下回饋：

- 原卡片位置保留 placeholder，讓使用者知道卡片原本在哪裡。
- 被移動的卡片使用適度浮起、陰影或透明度，而非過度動畫。
- 合法目標欄位以邊框或背景提示；不合法目標不可假裝可放下。
- 欄位中的插入位置要有清楚的間距或指示線。
- 若該卡片被別人 soft lock，拖曳把手停用，並以文字說明「某某正在移動此卡片」。
- 遵守使用者的減少動態效果偏好，將排序動畫縮短或關閉。

放下後先以本地預覽顯示新位置；進入多人同步階段後，這是暫時 optimistic state，直到伺服器確認或廣播權威結果。

### 5.4 邊緣自動捲動

卡片在同一欄內接近容器上下邊緣時，可自動垂直捲動；接近 Board canvas 左右邊緣時，未來可自動水平捲動以跨欄放置。

手機跨欄邊緣自動捲動是整個拖曳功能中較難且最需要真機驗證的部分，因此不屬於 Phase 1 的完成條件。Phase 2 若無法可靠處理，可先讓使用者拖到可見欄位，再補上緩慢、可停止、沒有抖動的邊緣捲動。不可因實作方便而改成整張卡片可拖曳。

## 6. 欄位拖曳互動

欄位（Column）與卡片的拖曳是兩個獨立功能，必須使用不同把手與不同事件：

| 項目           | 卡片                         | 欄位                  |
| -------------- | ---------------------------- | --------------------- |
| 初期開放範圍   | 桌機與手機                   | 桌機優先，手機延後    |
| 拖曳把手       | 卡片右上或標題旁的 Grip icon | 欄位標題列專用 Handle |
| 移動範圍       | 同欄排序、跨欄移動           | 同一 Board 的欄位排序 |
| Socket command | `card:move`                  | `column:move`         |
| soft lock 單位 | 單一 Card                    | 單一 Column           |

欄位拖曳不能讓使用者從標題文字、欄位內卡片或空白區直接開始。欄位本身正在被拖曳時，只鎖這一欄的排序操作，不影響別人在其他欄位移動卡片。是否允許他人在「被移動的欄位」內移動卡片，初期可以直接停用該欄的卡片拖曳，以降低狀態複雜度；這是該單一欄位的局部限制，不是全 Board 鎖定。

## 7. 前端資料與本地排序

### 7.1 Mock 資料形狀

Phase 0／1 可使用接近正式資料的 mock 形狀，避免 UI 完成後大幅重寫：

```ts
type MockCard = {
  id: string;
  columnId: string;
  title: string;
  position: number;
  version: number;
};

type MockBoardColumn = {
  id: string;
  boardId: string;
  title: string;
  position: number;
  colorKey: "ready" | "active" | "review" | "done";
  cards: MockCard[];
  version: number;
};
```

- 陣列順序用於畫面渲染；`position` 則是與後端交換的排序資訊。
- `id` 在同一個 mock board 中必須唯一，`v-for` 必須使用它作為 key。
- 現階段使用整數 `1, 2, 3, 4` 足以表達四欄預設順序；正式版由後端處理中間插入、重整與持久化。
- 預設欄位是「準備開始、正在進行、等待檢視、已完成」，但不是資料庫 enum；未來 Board 可建立、重新命名、排序或新增 Column。

### 7.2 本地拖曳結果

在尚未串 API 時，放下卡片後只更新本地 state：

1. 從來源欄位陣列移除 Card。
2. 插入目標欄位陣列的索引位置。
3. 更新 Card 的 `columnId`。
4. 重新計算畫面用的暫時 `position`。

不要在這一階段自行發明最終資料庫排序演算法。正式寫入時只送出相鄰關係（例如 `beforeCardId`、`afterCardId`）與 `expectedVersion`，由後端交易內決定 `position`。

## 8. 正式移動與版本衝突

### 8.1 Card 移動命令

進入 Phase 3 後，卡片放下時送出既有規格的 `card:move`。概念 payload 如下：

```ts
type CardMovePayload = {
  commandId: string;
  boardId: string;
  cardId: string;
  sourceColumnId: string;
  targetColumnId: string;
  beforeCardId: string | null;
  afterCardId: string | null;
  expectedVersion: number;
};
```

實際 envelope、授權、ACK、錯誤碼及廣播事件請依 [看板 API 與 WebSocket 規格](./board-api-websocket-spec.md)。客戶端不可提交自己算好的最終 `position` 作為可信結果，也不可只根據本地索引判斷移動成功。

### 8.2 衝突流程

```text
使用者 A、B 同時看到 Card-1 的 version = 7

A 放下卡片 → card:move(expectedVersion: 7) → Server 成功寫入，Card 變 version 8
B 放下卡片 → card:move(expectedVersion: 7) → Server 回覆 VERSION_CONFLICT

B 的前端 → 捨棄 optimistic 排序 → 顯示簡短提示 → 套用權威事件或重新同步 Board
```

這是第一版多人正確性的防線。即使未來已有 soft lock，仍必須保留，因為鎖可能過期、使用者可能斷線，也可能有舊版客戶端或 REST 寫入同一筆資料。

### 8.3 欄位移動命令

Column 拖曳完成後使用對應的 `column:move`，同樣傳遞 `commandId`、相鄰 Column ID 與 `expectedVersion`。它不能重用 `card:move`，因為授權、資料表、排序範圍與 soft lock key 都不同。

## 9. Soft lock 規格（Phase 4 之後）

### 9.1 原則

soft lock 是「讓其他使用者不要白費力氣」的 UX 提示，不是資料完整性機制：

- 不寫入 PostgreSQL，不增加 Card／Column 的持久欄位。
- 不鎖整個 Board，不鎖整個 Column 以外的所有卡片。
- 同一時間只鎖正在被拖曳的單一 Card 或單一 Column。
- TTL 預設為 10 秒，任何原因未正常結束都會自動解除。
- Server 仍對 `card:move`／`column:move` 做 `expectedVersion` 驗證。

### 9.2 Card soft lock 事件

下列事件是新增時的建議契約；實作階段須同步補入主要 Socket 規格文件。

| 事件                      | 方向                        | 用途                                             |
| ------------------------- | --------------------------- | ------------------------------------------------ |
| `card:drag-start`         | Client → Server（要求 ACK） | 請求取得某張卡片的 soft lock。                   |
| `card:drag-state-changed` | Server → Board room         | 廣播 Card 的拖曳鎖已開始或解除。                 |
| `card:drag-end`           | Client → Server             | 使用者取消或結束拖曳但沒有成功移動時，主動解除。 |

`card:drag-start` 必須由伺服器判斷並 ACK，不能由客戶端自行 broadcast「我鎖住了」。概念如下：

```ts
type CardDragStartPayload = {
  boardId: string;
  cardId: string;
};

type CardDragStartAck =
  | { acquired: true; expiresAt: string }
  | {
      acquired: false;
      lockedBy: { userId: string; displayName: string };
      expiresAt: string;
    };

type CardDragStateChangedPayload = {
  boardId: string;
  cardId: string;
  state: "started" | "ended" | "expired";
  lockedBy: { userId: string; displayName: string } | null;
  expiresAt: string | null;
};
```

成功取得 lock 才允許前端開始真正的協作拖曳。若 ACK 表示已被鎖定，卡片不應進入拖曳狀態，並顯示誰正在操作。`card:move` 成功、`card:drag-end`、socket disconnect 都必須主動釋放；TTL 則是最後的保險。

避免在使用者移動指標時持續送 `drag-move`。其他人只需要知道「此卡片正由誰處理」，不需要看到逐幀位置。

### 9.3 儲存策略

| 部署型態                  | 建議儲存方式                        | 原因                                            |
| ------------------------- | ----------------------------------- | ----------------------------------------------- |
| 單一 NestJS instance      | 記憶體 `Map` + timeout／過期檢查    | 實作簡單，足以驗證 UX。                         |
| 多個 API／Socket instance | Redis 原子 `SET key value NX EX 10` | 所有 instance 共用鎖，並由 Redis TTL 自動到期。 |

Redis key 可採類似 `board:{boardId}:card-drag-lock:{cardId}` 的形式。取得鎖、續期（若實作）與釋放必須驗證 owner，以免使用者 A 誤刪使用者 B 新取得的鎖。Column 使用獨立 key，例如 `board:{boardId}:column-drag-lock:{columnId}`。

第一版不必做 lock 續期。若拖曳可能長於 10 秒，再加入由 Server ACK 驅動、間隔明確且有 owner 驗證的續期機制；不要因為追求 lock 而讓拖曳路徑先變得複雜。

### 9.4 欄位 soft lock

Column soft lock 套用相同原則，但只在實作欄位拖曳時加入。可使用 `column:drag-start`、`column:drag-end`、`column:drag-state-changed` 的平行事件。它只禁止另一位使用者重新排序同一個 Column；並不鎖住整個 Board。

## 10. 斷線、逾時與失敗處理

| 情境                   | 前端行為                                                            | 伺服器行為                                      |
| ---------------------- | ------------------------------------------------------------------- | ----------------------------------------------- |
| 拖曳尚未送出移動就取消 | 回復本地預覽；若有 lock 則送 `drag-end`。                           | 解除該 entity 的 soft lock。                    |
| 成功放下               | 暫時顯示新位置，等待 ACK／權威事件。                                | 驗證權限與版本，交易寫入，廣播變更並釋放 lock。 |
| `VERSION_CONFLICT`     | 回復 optimistic state，顯示「此卡片已被更新」，套用廣播或重新同步。 | 不寫入過期命令。                                |
| Socket ACK 逾時        | 顯示同步中；保留 commandId 以安全重試或查詢最終結果。               | 利用 idempotency 避免重複命令造成重複移動。     |
| 使用者斷線             | 停止本地拖曳，連線恢復後重新同步。                                  | 立即釋放該 socket 擁有的 locks；TTL 仍為保險。  |
| Server 未正常釋放 lock | 顯示至 TTL 到期後自動恢復可拖曳。                                   | 過期時刪除 lock 並 broadcast `expired`。        |

重新連線後不得假設本地拖曳前的欄位順序仍有效。應依既有 Board snapshot／事件恢復機制取得權威狀態，再允許新的拖曳操作。

## 11. 無障礙與替代操作

拖曳永遠不是唯一的工作路徑。至少提供下列能力：

- 卡片詳情中提供「移動至…」選單，可選目標欄位。
- 必要時提供「移到最前／最後」或鄰近位置的排序操作。
- 移動成功後，把焦點保留在卡片或移動控制項，並透過可讀取的狀態訊息告知新欄位。
- 拖曳把手有可辨識的 accessible name；圖示不可是唯一提示。
- soft lock、錯誤與衝突不能只用顏色表示，需有文字。
- 尊重 `prefers-reduced-motion`，減少排序與浮起動畫。

如果拖曳函式庫提供鍵盤拖曳，不代表可以省略「移動至…」選單；後者對觸控、螢幕閱讀器與精確排序都更可靠。

## 12. 測試與驗收條件

### 12.1 Phase 0／2 前端驗收

- [ ] 四個預設欄位可正確由唯一 ID 的 mock 資料渲染。
- [ ] 新增多個測試欄位時，手機與桌機都可原生水平捲動到最後一欄。
- [ ] 欄位不換行、不被壓縮到影響卡片閱讀。
- [ ] 點擊／短按卡片內容不會開始拖曳。
- [ ] 僅拖曳把手可開始拖曳；手機必須長按才開始。
- [ ] 卡片可在同欄與跨欄排序，本地 state 的 `columnId` 與陣列順序正確。
- [ ] 手機直向捲動、Board 橫向捲動與卡片拖曳不會互相卡住。
- [ ] 實際 iOS Safari、Android Chrome、桌機 Chrome／Safari 至少各驗證一次。

### 12.2 Phase 3 協作驗收

- [ ] 同一張卡片兩個使用者同時放下時，只有符合 `expectedVersion` 的命令成功。
- [ ] 被拒絕的使用者會回復到伺服器權威順序，不留下重複或遺失卡片。
- [ ] 跨欄移動後，來源欄、目標欄與 Card 的 `columnId` 一致。
- [ ] 斷線重連後會同步權威 Board 資料，不套用過期的本地排序。
- [ ] 同一個 `commandId` 重送不會造成重複移動。

### 12.3 Phase 4 soft lock 驗收

- [ ] A 取得 Card-1 lock 後，B 看到鎖定提示且無法從把手開始拖曳 Card-1。
- [ ] A 仍可拖曳其他未鎖定卡片；B 也可拖曳其他未鎖定卡片。
- [ ] A 放下、取消或斷線後，lock 立即解除。
- [ ] 未正常解除時，lock 在 10 秒 TTL 後恢復。
- [ ] 即使 soft lock 存在，模擬過期版本命令仍會收到 `VERSION_CONFLICT`。
- [ ] 多 instance 部署時，兩個 Socket instance 不能同時取得同一個 entity lock。

## 13. 實作檢查清單

開始每個階段前，依序確認：

1. BoardColumn 與 Card 的 UI 結構是否已把「內容、拖曳把手、捲動容器」分開。
2. mock 資料是否具有唯一 ID、`position`、`version` 與正確 `columnId`。
3. 是否先用本地 state 驗證拖曳結果，再把同一份資料形狀接到 API。
4. Socket command 是否帶有 `commandId`、`expectedVersion` 和相鄰項目 ID。
5. API／Socket 拒絕時，是否有明確的回復、同步與使用者提示。
6. soft lock 是否僅在版本衝突機制已完成後加入，且有 TTL 與 disconnect 清理。
7. 是否在真機測試長按、橫滑、垂直捲動與跨欄拖曳，而非只在桌機開發工具模擬。

## 14. 與主 API／Socket 規格的關係

本文件新增或約束的內容，應在實作時同步回填到 [看板 API 與 WebSocket 規格](./board-api-websocket-spec.md)：

- `card:move` 與 `column:move` 的實際 payload、ACK、錯誤碼與廣播資料。
- 命令 idempotency、`expectedVersion` 與 reconnect 後的 Board snapshot 流程。
- Phase 4 新增的 `card:drag-*` soft lock 事件。
- Phase 5 新增的 `column:drag-*` soft lock 事件。

兩份文件若有衝突，以主 API／Socket 規格的已實作契約為準；本文件的互動原則（明確把手、長按、局部 soft lock、版本檢查保底）則應維持不變。
