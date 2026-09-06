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

目前 UI 版本標記為 `v4`。此版本包含 Workspace Invite，並新增 `Notification Trigger`、`Notification Item`、`Notification Dropdown` Component Sets 與 `Notifications` Screens 分區。通知 Dropdown 提供 Desktop／Mobile 的 Default、Loading、Empty、Error variants；Component description 會標出對應的 shadcn-vue／Flowboard common 元件。

## Idempotency

Plugin 只會刪除有 `flowboard-generator` pluginData 的根節點。Variables 與 Styles 會依名稱更新，Components／Screens 則會安全地替換該 Plugin 上次生成的 root，手動加入到頁面的內容不會被清除。
