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

目前 UI 版本標記為 `v5`。此版本在既有 Workspace Invite 與 Notification 基礎上，新增 `Workspace Invitation Response` Component Set，以及 Desktop／Mobile／States Screens。邀請回覆提供 Pending、Responding、Accepted、Declined、Error variants；通知 Dropdown 新增 Invitation variant，並以 Component Instances 組合邀請回覆與既有通知項目。

2026-09-11 已在 Figma Desktop 的既有 `Flowboard — Native Design System` 執行兩次 `Generate All`：兩次皆完成 Foundations、Components 與 Screens，第二次搜尋結果維持 Components 4 筆、Screens 13 筆，未累積重複 generated roots。Desktop 邀請回覆 Screen 已完成 runtime／visual check。

## v5 source-to-output manifest

| Source | Viewport／state | Figma output |
| --- | --- | --- |
| `../design/workspace-invitation-response.svg` | Desktop `1440 × 900` | `03 · Screens` → `Workspace Invitation Response` → Desktop |
| `../design/workspace-invitation-response-mobile.svg` | Mobile `390 × 844` | `03 · Screens` → `Workspace Invitation Response` → Mobile |
| `../design/workspace-invitation-response-states.svg` | Pending／Responding／Accepted／Declined／Error | `02 · Components` → `Workspace Invitation Response`; `03 · Screens` → States |

共用 Button、Notification Item、Notification Dropdown、Avatar、色彩、圓角與字型均沿用既有 Components／Variables。SVG 只作視覺依據，不會匯入 Canvas。

## Idempotency

Plugin 只會刪除有 `flowboard-generator` pluginData 的根節點。Variables 與 Styles 會依名稱更新，Components／Screens 則會安全地替換該 Plugin 上次生成的 root，手動加入到頁面的內容不會被清除。
