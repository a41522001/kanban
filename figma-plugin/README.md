# Flowboard Figma Development Plugin

這個 Plugin 會把 `../design/*.svg` 與 `../frontend/src/styles/index.css` 已定義的視覺規則，重建為 Figma 原生的 Variables、Styles、Components、Auto Layout 與 Screens。它不會將 SVG 匯入 Canvas。

## Build

```powershell
cd D:\Personal\kanban\figma-plugin
npm install
npm run build
```

開發時可改用：

```powershell
npm run watch
```

每次完成 build 或 watch 更新後，在 Figma 的 Development Plugin 視窗按 `Reload`。

## Import and run

1. 在 Figma 開啟任一 Design file（例如先前建立的 `Flowboard — Native Design System`）。
2. 選擇 `Plugins` → `Development` → `Import plugin from manifest…`。
3. 選取 `D:\Personal\kanban\figma-plugin\manifest.json`。
4. 選擇 `Plugins` → `Development` → `Flowboard Native Design Generator`。
5. 按 `Generate All`；也可以單獨重建 Foundations、Components 或 Screens。

## Idempotency

Plugin 只會刪除有 `flowboard-generator` pluginData 的根節點。Variables 與 Styles 會依名稱更新，Components／Screens 則會安全地替換該 Plugin 上次生成的 root，手動加入到頁面的內容不會被清除。
