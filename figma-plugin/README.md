# Flowboard Figma Development Plugin

這個 Plugin 會把 `../design/*.svg` 與 `../frontend/src/styles/index.css` 已定義的視覺規則，重建為 Figma 原生的 Variables、Styles、Components、Auto Layout 與 Screens。它不會將 SVG 匯入 Canvas。

## Build

```sh
cd "/Volumes/Crucial X9/practice/websocket/kanban/figma-plugin"
npm install
npm run build
```

開發時可改用：

```sh
npm run watch
```

每次完成 build 或 watch 更新後，在 Figma 的 Development Plugin 視窗按 `Reload`。

> 本機 Development Plugin 必須使用 Figma Desktop App。網頁版無法讀取本機 `manifest.json` 與 `dist`；一般 Community Plugin 搜尋也不會列出此 Plugin。

## Import and run

1. 使用 Figma Desktop 開啟既有的 `Flowboard — Native Design System`。
2. 在 Canvas 按右鍵，選擇 `Plugins` → `Development` → `Import plugin from manifest…`。
3. 選取 `/Volumes/Crucial X9/practice/websocket/kanban/figma-plugin/manifest.json`。
4. 選擇 `Plugins` → `Development` → `Flowboard Native Design Generator`。
5. 按 `Generate All`；也可以單獨重建 Foundations、Components 或 Screens。

目前 UI 版本標記為 `v11`。Workspace 與 Project Overview 已整併為唯一的 `Workspace Project Overview`：Desktop 使用 `Default`／`Selected` master-detail；Tablet／Mobile 使用 `Default`／`Expanded` accordion。未展開卡片只使用 Project list API 資料，展開後才載入成員詳情並顯示「進入主要看板」。

2026-09-12 已在 Figma Desktop 的既有 `Flowboard — Native Design System` 連續執行兩次修正後的 v7 `Generate All`：兩次皆完成 Foundations、Components 與 Screens，未累積重複 generated roots。已確認 Dialog Component Set 有 12 個分開排列的 variants，Screen 使用 Instances，並完成 Dialog states 與 Notification Item interaction contract 的 runtime／visual check。

2026-09-18 已在 Figma Desktop 的既有 `Flowboard — Native Design System` 連續執行兩次 v9 `Generate All`；兩次皆完成 Foundations、Components 與 Screens，未累積重複 generated roots。Workspace Overview 的 Desktop／Tablet／Mobile 畫面亦已完成 runtime／visual check。

## v11 source-to-output manifest

| Source | Viewport／state | Figma output |
| --- | --- | --- |
| `../design/workspace-overview.svg` | Desktop `1440 × 900` | `02 · Components` → `Project Card`／`Selected Project Members`; `03 · Screens` → `Workspace Project Overview` → Desktop |
| `../design/workspace-overview-tablet.svg` | Tablet `768 × 1024` | `02 · Components` → `Project Card`; 同上 → Tablet |
| `../design/workspace-overview-mobile.svg` | Mobile `390 × 844` | `02 · Components` → `Project Card`; 同上 → Mobile |
| `../design/notification-dropdown.svg` | Desktop `1440 × 900` | `02 · Components` → `Notification Item`／`Notification Dropdown`; `03 · Screens` → `Notifications` → Desktop |
| `../design/notification-dropdown-mobile.svg` | Mobile `390 × 844` | 同上 → Mobile |
| `../design/notification-dropdown-states.svg` | Loading／Empty／Error | `02 · Components` → `Notification Dropdown`; `03 · Screens` → Runtime States |
| `../design/notification-item-interactions.svg` | Desktop／Mobile hit targets、Type routing、focus return | `03 · Screens` → `Notifications` → Interaction Contract |
| `../design/workspace-invitation-response.svg` | Desktop `1440 × 900`，Dialog `520 × 456` | `03 · Screens` → `Workspace Invitation Detail Dialog` → Desktop |
| `../design/workspace-invitation-response-mobile.svg` | Mobile `390 × 844`，Dialog `358 × 570` | 同上 → Mobile |
| `../design/workspace-invitation-response-states.svg` | Loading／Pending／Responding／Accepted／Declined／Unavailable | `02 · Components` → `Workspace Invitation Detail Dialog`; `03 · Screens` → States |
| `../design/notification-read-actions-states.svg` | Single／All × Default／Processing／Complete／Error | `02 · Components` → `Notification Read Action`; `03 · Screens` → `Notifications` → Read Actions / States |

共用 Button、Notification Item、Notification Dropdown、Avatar、色彩、圓角與字型均沿用既有 Components／Variables。SVG 只作視覺依據，不會匯入 Canvas。

## Idempotency

Plugin 只會刪除有 `flowboard-generator` pluginData 的根節點。Variables 與 Styles 會依名稱更新，Components／Screens 則會安全地替換該 Plugin 上次生成的 root，手動加入到頁面的內容不會被清除。
