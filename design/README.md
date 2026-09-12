# Flowboard SVG design source

SVG 是 **Visual Reference**；最終設計稿必須由 Plugin 重新建立為原生 Figma Frame、Auto Layout、Component、Variant、Variables 與 Styles，不能把 SVG 匯入後當成完成品。

## Source of truth

| Area | Desktop | Tablet | Mobile | Status |
| --- | --- | --- | --- | --- |
| Login | `auth-login.svg` | — | `auth-login-mobile.svg` | Current |
| Signup | `auth-signup.svg` | — | `auth-signup-mobile.svg` | Current |
| Workspace | `workspace-overview.svg` | `workspace-overview-tablet.svg` | `workspace-overview-mobile.svg` | Current |
| Workspace invitation | `workspace-invite-member-dialog.svg` | — | `workspace-invite-member-dialog-mobile.svg` | Current |
| Workspace invitation response | `workspace-invitation-response.svg` | — | `workspace-invitation-response-mobile.svg` | Current |
| Workspace invitation response states | `workspace-invitation-response-states.svg` | — | — | Current spec page |
| Notification dropdown | `notification-dropdown.svg` | — | `notification-dropdown-mobile.svg` | Current |
| Notification states | `notification-dropdown-states.svg` | — | — | Current spec page |
| Notification read actions | `notification-read-actions-states.svg` | — | — | Current spec page |
| Notification item interactions | `notification-item-interactions.svg` | — | — | Current spec page |
| Board | `board-overview.svg` | `board-overview-tablet.svg` | `board-overview-mobile.svg` | Current |
| Create card | `create-card-dialog.svg` | — | `create-card-dialog-mobile.svg` | Current |
| Card detail | `card-detail.svg` | — | `card-detail-mobile.svg` | Current |
| Drag and collaboration | `board-drag-states.svg` | — | — | Current spec page |
| System states | `board-system-states.svg` | — | — | Current spec page |

## Legacy boundary

所有合併多頁稿與舊 `*-rwd.svg` 都已移至 `design/archive/`，只作歷史追溯，不可再作為 Figma Generator 的輸入。`design` 根目錄中的每一個 SVG 都只代表一個畫面或一個規格頁。

## Board v2 contract

- Desktop 為 `1440 × 900`，全寬專注模式，沒有 persistent Sidebar。
- Header 有 Brand、工作區／最近導覽、Create、Avatar。
- Board heading 有 Breadcrumb、同步狀態、Collaborator avatars、Project members action。
- Column 寬度固定：Desktop／Tablet `280px`、Mobile `288px`。
- Tablet 與 Mobile 透過水平捲動瀏覽欄位，並保留 scroll indicator；不可壓縮欄寬。
- `44 × 44` Card drag handle 與 `40 × 40` Column drag handle 是操作元件，不是裝飾文字。
- Board 必須包含進度、完成、soft lock、Add card、Add column 等不同卡片／欄位語意。

## Card data contract

資料模型與 `frontend/src/types/board.ts` 對齊：

```text
Card
├── title (required)
├── category? { name, colorKey }
└── labels[]
```

類別色彩使用 `frontend/src/constants/cardCategoryColors.ts` 的 14 個限定色：`coral`、`rose`、`orange`、`amber`、`lime`、`mint`、`teal`、`cyan`、`blue`、`indigo`、`lavender`、`violet`、`pink`、`slate`。色彩屬於 Category，不是獨立 Card 欄位；Labels 為可多選 token input。

## Workspace invitation contract

- 邀請入口只提供給工作區 Owner；權限仍由後端作最終判定。
- Dialog 對應 `shadcn-vue/Dialog` 與 `shadcn-vue/Button`，Email 欄位對應 Flowboard `shared/Input`。
- 表單只輸入已註冊使用者的 Email，角色固定為 `MEMBER`，不在第一版加入角色選擇器。
- 「傳送邀請」成功只建立 invitation 與 notification；受邀者接受前不會出現在正式成員列表。
- Desktop 使用置中 `520px` Dialog；Mobile 保留 `16px` viewport gutter，使用 `358px` inset Dialog，而不是全螢幕頁面。
- Loading 時停用關閉與送出以避免重複請求；欄位驗證顯示在 Email 下方，商業錯誤以 Toast 呈現並保留輸入值。

## Notification dropdown contract

- Header 使用 `40 × 40` Notification Trigger；有未讀時顯示數字 Badge，Dropdown 開啟時使用 Open variant。
- Dropdown 對應 `shadcn-vue/DropdownMenuContent` 與 `ScrollArea`，Desktop 寬 `400px`，Mobile 保留 `16px` gutter、寬 `358px`。
- 列表與未讀數分別使用 `GET /notifications`、`GET /notifications/unreadCount`；單筆與全部已讀分別使用 `PATCH /notifications/read`、`PATCH /notifications/readAll`。
- 每則未讀通知提供明確的單筆已讀按鈕；Desktop 以 tooltip 補充名稱，Mobile 保留至少 `44 × 44` 的觸控區，不讓整張通知卡隱含執行已讀。
- 「全部設為已讀」位於 Dropdown header。處理中停用全部已讀操作但保持列表與 Dropdown 開啟；成功後原地更新 unread 樣式、未讀數與 Bell badge。
- `WORKSPACE_INVITED` 列表項目只依 notification type 與 resource pointer 導流；`workspaceName`、`inviterDisplayName` 與 `role` 由 Workspace Invitation detail API 提供，不存入 notification payload。
- Unread 與 Read 使用背景、border、文字層級及 unread dot 同時區分，不只依賴顏色。
- Notification Item 的內容區與已讀按鈕是兩個獨立操作目標；內容區依 Type 開啟對應的 domain UI，已讀按鈕只更新 readAt，不得觸發導頁或資源動作。
- 通知列表不呈現 invitation 的 PENDING／ACCEPTED／DECLINED 等資源狀態；列表只負責通知摘要與已讀／未讀。
- Runtime variants 至少包含 Default、Loading、Empty、Error；載入錯誤提供「重新載入」。
- Socket.IO 日後只觸發列表／未讀數同步，PostgreSQL 與 HTTP read model 仍是通知真相。

## Workspace invitation response contract

- 點擊 WORKSPACE_INVITED 通知內容後關閉 Dropdown，以 notificationId 載入最新資源詳情，再開啟 Workspace Invitation Dialog；前端不得信任或自行提交列表中的 resourceId／Type 作授權依據。
- Invitation Dialog 屬於 Workspace Invitation domain UI，不屬於 Notification Item。Desktop 使用置中 `520px` Dialog；Mobile 使用 `358px` inset Dialog，並保留 `16px` viewport gutter。
- 「接受邀請」是唯一主要操作；「婉拒」使用中性 outline，不使用 danger 色，因為它不會刪除既有資料。
- Desktop 動作高度為 `44px`，Mobile 為 `48px`；送出任一回覆時兩個動作都必須停用，避免 accept／decline 並行競爭。
- Dialog 支援 Loading、Pending、Responding、Accepted、Declined、Unavailable／Expired；接受成功時重新載入 Workspace 列表並提供「前往工作區」，婉拒後只保留關閉操作。
- 詳情載入或 API 失敗時保留 Dialog，畫面使用穩定 `ApiCode` 決定文案，不直接顯示後端 message；關閉後焦點回到原通知項目。
- 回覆狀態不等同已讀狀態；開啟詳情是否自動標記已讀是獨立產品規則，不得把 accept／decline 當成 Notification 本身的狀態。

## Single-page file rule

- Desktop、Tablet、Mobile 必須是不同 SVG 檔案。
- Login 與 Signup 必須是不同 SVG 檔案。
- 禁止在同一 SVG 內橫向或縱向排列多個產品畫面。
- `board-drag-states.svg` 與 `board-system-states.svg` 是狀態規格頁，允許在同一規格頁內展示多個 Variant。
- `notification-dropdown-states.svg` 是 Notification runtime state 規格頁，允許展示 Loading、Empty、Error 與 Trigger variants。
- `notification-read-actions-states.svg` 是已讀操作規格頁，允許展示單筆／全部的 Default、Processing、Complete 與 Error recovery。
- `notification-item-interactions.svg` 是 Notification Item 操作分區與 Type routing 規格頁，允許展示 Desktop／Mobile、Unread／Read 與 interaction anatomy。
- `workspace-invitation-response-states.svg` 是邀請詳情 Dialog 規格頁，允許展示 Loading、Pending、Responding、Accepted、Declined 與 Unavailable／Expired。
- 新增裝置版本時使用 `*-tablet.svg`、`*-mobile.svg` 命名，不再使用含混的 `*-rwd.svg`。

## Figma regeneration gate

- Board 不引用 `design/archive/` 內的舊稿。
- Card Detail 改為 v2 外殼，不直接沿用舊 Board 版型。
- Create Card 的 14 色順序與前端常數一致。
- Drag specs 的六種狀態皆有 Component / Variant 對應。
- 所有新增狀態都有 Desktop 或 Mobile 的明確畫面。
- Workspace invitation 的 Dialog、Input 與 Button 皆有原生 Figma Component／Instance 對應。
- Notification Trigger、Notification Item 與 Notification Dropdown 皆有原生 Component Set／Variant 對應。
- Notification Read Action 需建立 Single／All 與 Default／Processing／Complete／Error variants，並保留 focus、disabled 與 `aria-live` 行為註記。
- Notification Item 的 content action 與 read action 必須是分離的互動區；Workspace Invitation Response 必須由獨立 Dialog Component Set 組成，不在 Dropdown Item 內放接受／婉拒按鈕。
