# Flowboard SVG design source

SVG 是 **Visual Reference**；最終設計稿必須由 Plugin 重新建立為原生 Figma Frame、Auto Layout、Component、Variant、Variables 與 Styles，不能把 SVG 匯入後當成完成品。

## Source of truth

| Area | Desktop | Tablet | Mobile | Status |
| --- | --- | --- | --- | --- |
| Login | `auth-login.svg` | — | `auth-login-mobile.svg` | Current |
| Signup | `auth-signup.svg` | — | `auth-signup-mobile.svg` | Current |
| Workspace | `workspace-overview.svg` | `workspace-overview-tablet.svg` | `workspace-overview-mobile.svg` | Current |
| Workspace invitation | `workspace-invite-member-dialog.svg` | — | `workspace-invite-member-dialog-mobile.svg` | Current |
| Notification dropdown | `notification-dropdown.svg` | — | `notification-dropdown-mobile.svg` | Current |
| Notification states | `notification-dropdown-states.svg` | — | — | Current spec page |
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
- Dialog 對應 `shadcn-vue/Dialog` 與 `shadcn-vue/Button`，Email 欄位對應 Flowboard `common/Input`。
- 表單只輸入已註冊使用者的 Email，角色固定為 `MEMBER`，不在第一版加入角色選擇器。
- 「傳送邀請」成功只建立 invitation 與 notification；受邀者接受前不會出現在正式成員列表。
- Desktop 使用置中 `520px` Dialog；Mobile 保留 `16px` viewport gutter，使用 `358px` inset Dialog，而不是全螢幕頁面。
- Loading 時停用關閉與送出以避免重複請求；欄位驗證顯示在 Email 下方，商業錯誤以 Toast 呈現並保留輸入值。

## Notification dropdown contract

- Header 使用 `40 × 40` Notification Trigger；有未讀時顯示數字 Badge，Dropdown 開啟時使用 Open variant。
- Dropdown 對應 `shadcn-vue/DropdownMenuContent` 與 `ScrollArea`，Desktop 寬 `400px`，Mobile 保留 `16px` gutter、寬 `358px`。
- 第一版只依 `GET /notifications` 與 `GET /notifications/unreadCount` 顯示通知及未讀數，不提供尚未有 Controller API 的標記已讀、全部已讀、接受或拒絕操作。
- `WORKSPACE_INVITED` 文案來自 notification payload 的 `workspaceName`、`inviterDisplayName` 與 `role`；不得把翻譯後完整句子存入 payload。
- Unread 與 Read 使用背景、border、文字層級及 unread dot 同時區分，不只依賴顏色。
- Runtime variants 至少包含 Default、Loading、Empty、Error；載入錯誤提供「重新載入」。
- Socket.IO 日後只觸發列表／未讀數同步，PostgreSQL 與 HTTP read model 仍是通知真相。

## Single-page file rule

- Desktop、Tablet、Mobile 必須是不同 SVG 檔案。
- Login 與 Signup 必須是不同 SVG 檔案。
- 禁止在同一 SVG 內橫向或縱向排列多個產品畫面。
- `board-drag-states.svg` 與 `board-system-states.svg` 是狀態規格頁，允許在同一規格頁內展示多個 Variant。
- `notification-dropdown-states.svg` 是 Notification runtime state 規格頁，允許展示 Loading、Empty、Error 與 Trigger variants。
- 新增裝置版本時使用 `*-tablet.svg`、`*-mobile.svg` 命名，不再使用含混的 `*-rwd.svg`。

## Figma regeneration gate

- Board 不引用 `design/archive/` 內的舊稿。
- Card Detail 改為 v2 外殼，不直接沿用舊 Board 版型。
- Create Card 的 14 色順序與前端常數一致。
- Drag specs 的六種狀態皆有 Component / Variant 對應。
- 所有新增狀態都有 Desktop 或 Mobile 的明確畫面。
- Workspace invitation 的 Dialog、Input 與 Button 皆有原生 Figma Component／Instance 對應。
- Notification Trigger、Notification Item 與 Notification Dropdown 皆有原生 Component Set／Variant 對應。
