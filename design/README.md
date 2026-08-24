# Flowboard 視覺稿（v2）

## 檔案

- `kanban-trello-ui.svg`：包含 Login、Signup、Kanban Board、Card Detail 四個 1440 × 900 畫面。
- `kanban-trello-rwd.svg`：包含 Mobile Login、Mobile Signup、Tablet Board、Mobile Board、Mobile Card Detail。
- `workspace-overview.svg`：工作區總覽桌機版，包含工作區切換、最近開啟、所有專案與成員概況。
- `workspace-overview-rwd.svg`：工作區總覽的 Tablet 768 × 1024 與 Mobile 390 × 844 版型。
- `board-overview.svg`：目前版 Board 桌機設計，包含 Workspace／Project／Board 路徑、四個預設欄位、拖曳把手與新增欄位入口。
- `board-overview-rwd.svg`：目前版 Board 的 Tablet 768 × 1024 與 Mobile 390 × 844 版型。
- `board-drag-states.svg`：卡片拖曳、Drop target、soft lock、手機長按及「移動至…」替代操作的元件狀態稿。
- `create-card-dialog.svg`：桌機版新增卡片 Dialog，包含目標欄位、標題、類別、14 色票、標籤與操作列。
- `create-card-dialog-rwd.svg`：Mobile 390 × 844 的新增卡片 bottom sheet；所有色票與操作按鈕皆保留觸控尺寸。

## 視覺規則

這版以「工作筆記／流程軌跡」為方向，不使用漸層，也不以大型浮動白卡片作為主要視覺。

| 用途                     | Token               | 色碼      |
| ------------------------ | ------------------- | --------- |
| Board base（所有裝置）   | Mist                | `#E9ECF1` |
| Auth surface（所有裝置） | Paper               | `#F7F8FA` |
| 導覽與結構色             | Ink                 | `#29324A` |
| 主要操作與目前進度       | Signal coral        | `#DF6E51` |
| 主要按鈕底色             | Signal coral strong | `#B94B36` |
| 成功／進行中             | Soft mint           | `#A9D2C8` |
| 提醒                     | Warm amber          | `#E6B960` |
| 補充分類                 | Muted violet        | `#907ECE` |

桌面和手機共用相同的 base token：登入頁為 `#F7F8FA`，看板為 `#E9ECF1`。手機版只拿掉桌面側欄與縮短文字，不會更換色系或改用漸層。

看板的四個欄位保留固定寬度；平板與手機透過水平捲動檢視下一欄，而不是把欄位壓窄。

資訊層級定義為 `Workspace → Project → Board`。工作區包含多個專案，每個專案至少有一個主要看板；使用者先在工作區總覽選擇專案，再進入該專案的主要 Board。桌機使用左側工作區導覽；平板與手機收斂成頁首選擇器。

所有頁面間距遵循 4px spacing grid，常用層級為 `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64`。元件尺寸與視覺對齊可做光學微調，但元件之間的 padding、gap 與 section spacing 必須使用 4px 的倍數。

## 匯入 Figma

1. 開啟目標 Figma Design 檔。
2. 將需要的 SVG 直接拖曳進畫布，或使用 **File → Place image**。
3. Workspace 與 Board 請優先使用 `workspace-overview*`、`board-overview*`；`kanban-trello-*` 內嵌的舊 Board 畫面只保留作為 v2 歷史參考。
4. 匯入後取消群組，再依照 SVG 內的 group id 整理為對應 Frame 與 Component。

## 注意事項

- SVG 會保留可編輯的向量、文字與群組。
- SVG 不會自動建立 Figma Variables、Auto Layout、Components 或 prototype interactions。
- 畫面使用 `Noto Sans TC`；若 Figma 無法取得該字型，可能顯示替代字型。
- 等 Figma MCP 額度恢復後，可再將這份視覺稿整理成正式元件與 Auto Layout。
