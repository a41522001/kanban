# Flowboard 視覺稿（v2）

## 檔案

- `kanban-trello-ui.svg`：包含 Login、Signup、Kanban Board、Card Detail 四個 1440 × 900 畫面。
- `kanban-trello-rwd.svg`：包含 Mobile Login、Mobile Signup、Tablet Board、Mobile Board、Mobile Card Detail。

## 視覺規則

這版以「工作筆記／流程軌跡」為方向，不使用漸層，也不以大型浮動白卡片作為主要視覺。

| 用途 | Token | 色碼 |
| --- | --- | --- |
| Board base（所有裝置） | Mist | `#E9ECF1` |
| Auth surface（所有裝置） | Paper | `#F7F8FA` |
| 導覽與結構色 | Ink | `#29324A` |
| 主要操作與目前進度 | Signal coral | `#DF6E51` |
| 成功／進行中 | Soft mint | `#A9D2C8` |
| 提醒 | Warm amber | `#E6B960` |
| 補充分類 | Muted violet | `#907ECE` |

桌面和手機共用相同的 base token：登入頁為 `#F7F8FA`，看板為 `#E9ECF1`。手機版只拿掉桌面側欄與縮短文字，不會更換色系或改用漸層。

看板的四個欄位保留固定寬度；平板與手機透過水平捲動檢視下一欄，而不是把欄位壓窄。

## 匯入 Figma

1. 開啟目標 Figma Design 檔。
2. 將 `kanban-trello-ui.svg` 直接拖曳進畫布，或使用 **File → Place image**。
3. 匯入後取消群組，依照 `desktop-login`、`desktop-signup`、`desktop-board`、`desktop-card-detail` 四組內容分別整理。
4. 為每組建立 1440 × 900 Frame，再把內容移入對應 Frame。

## 注意事項

- SVG 會保留可編輯的向量、文字與群組。
- SVG 不會自動建立 Figma Variables、Auto Layout、Components 或 prototype interactions。
- 畫面使用 `Noto Sans TC`；若 Figma 無法取得該字型，可能顯示替代字型。
- 等 Figma MCP 額度恢復後，可再將這份視覺稿整理成正式元件與 Auto Layout。
