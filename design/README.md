# Flowboard SVG design source

SVG 是 **Visual Reference**；最終設計稿必須由 Plugin 重新建立為原生 Figma Frame、Auto Layout、Component、Variant、Variables 與 Styles，不能把 SVG 匯入後當成完成品。

## Source of truth

| Area | Desktop | Tablet | Mobile | Status |
| --- | --- | --- | --- | --- |
| Login | `auth-login.svg` | — | `auth-login-mobile.svg` | Current |
| Signup | `auth-signup.svg` | — | `auth-signup-mobile.svg` | Current |
| Workspace | `workspace-overview.svg` | `workspace-overview-tablet.svg` | `workspace-overview-mobile.svg` | Current |
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

## Single-page file rule

- Desktop、Tablet、Mobile 必須是不同 SVG 檔案。
- Login 與 Signup 必須是不同 SVG 檔案。
- 禁止在同一 SVG 內橫向或縱向排列多個產品畫面。
- `board-drag-states.svg` 與 `board-system-states.svg` 是狀態規格頁，允許在同一規格頁內展示多個 Variant。
- 新增裝置版本時使用 `*-tablet.svg`、`*-mobile.svg` 命名，不再使用含混的 `*-rwd.svg`。

## Figma regeneration gate

- Board 不引用 `design/archive/` 內的舊稿。
- Card Detail 改為 v2 外殼，不直接沿用舊 Board 版型。
- Create Card 的 14 色順序與前端常數一致。
- Drag specs 的六種狀態皆有 Component / Variant 對應。
- 所有新增狀態都有 Desktop 或 Mobile 的明確畫面。
