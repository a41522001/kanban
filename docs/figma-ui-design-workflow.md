# Figma UI 設計稿工作流程

本文件定義 Flowboard UI 設計稿的來源、產生方式與驗收條件。目標不是把 SVG 圖片放進 Figma，而是產生可編輯、可重用且能對應 Vue 元件的原生 Figma 設計系統。

## 1. 固定資產與責任

| 路徑 | 責任 |
| --- | --- |
| `design/README.md` | Current visual references 清單與各功能的視覺 contract |
| `design/*.svg` | 一個檔案對應一個畫面或規格頁，只作 visual reference |
| `design/archive/` | 歷史稿，不可再作為 Generator 輸入 |
| `figma-plugin/` | 將 tokens、components 與 screens 重建為原生 Figma nodes |
| `frontend/src/styles/index.css` | Flowboard 語意色彩、圓角、陰影與字體 token |
| `frontend/src/components/ui` | shadcn-vue primitives |
| `frontend/src/components/shared` | Flowboard 跨功能共用元件 |
| `frontend/src/components/account`、`workspace`、`notifications`、`board` | 依產品功能領域分組的組合元件 |

除非使用者明確要求新檔案，不得另建空白 Figma file 取代既有 `Flowboard — Native Design System`。不得直接匯入 SVG 並將向量圖層視為完成的設計稿。

## 2. 設計順序

每次新增或大幅調整畫面，都依下列順序進行：

1. 讀取 `design/README.md`、本文件及相關功能文件。
2. 盤點既有 SVG、Plugin components、前端 shadcn-vue／shared／domain 元件與 tokens。
3. 在 `design/` 根目錄新增或修改單頁 SVG，並同步更新 Current 清單。
4. 更新既有 `figma-plugin/src/code.ts`；不得建立另一個平行 Generator。
5. 先產生／更新 Foundations，再產生 Components，最後組合 Screens。
6. Build Plugin，使用 Figma Desktop 執行 `Generate All`。
7. 比對 Current SVG 與 Figma Screen，檢查 responsive、狀態、元件 instance 與重跑結果。

## 3. 原生 Figma 結構

- Page 固定為 `01 · Foundations`、`02 · Components`、`03 · Screens`。
- Screen 依功能分區，例如 `Workspace`、`Workspace Invite`、`Board`，Desktop／Tablet／Mobile 放在同一功能 section。
- Dialog、Button、Input、Avatar、Badge 等重複元素必須由 Component／Component Set 建立，Screen 只放 Instance。
- Layout 優先使用 Auto Layout；absolute positioning 僅用於 overlay、scrim 或確實需要疊放的內容。
- 圖層使用產品語意命名，例如 `Workspace context`、`Dialog footer`，不得大量保留 `Frame 123`。
- Component description 必須標示程式端對應，例如 `shadcn-vue/DialogContent`、`shared/Input` 或 `notifications/WorkspaceInvitationResponseCard`。
- 顏色、間距與圓角優先綁定 Flowboard Variables／Styles；Variables API 不可用時才保留相同值的 editable native style。
- Icon 使用原生 vector node，不使用 Unicode 字元冒充操作 icon。

## 4. Responsive 與狀態

- Desktop 基準為 `1440 × 900`；Mobile 基準為 `390 × 844`；有實際結構差異時才新增 Tablet `768 × 1024`。
- 每個 SVG 只能包含一個產品畫面；Desktop、Tablet、Mobile 使用不同檔案。
- Dialog 在 Mobile 至少保留 `16px` viewport gutter，互動 target 以 `44px` 左右為基準。
- 功能需依適用情況涵蓋 default、focused、validation error、loading／disabled、server error、empty 與 success feedback。
- 畫面文案需符合 i18n key 可承載的語意；純範例資料可直接使用 workspace name 或 example Email。

## 5. Plugin build 與執行

本機 Development Plugin 只能由 **Figma Desktop App** 匯入與執行；Figma 網頁版無法讀取本機 `manifest.json` 與 `dist`。

```sh
cd "/Volumes/Crucial X9/practice/websocket/kanban/figma-plugin"
npm install
npm run build
```

若 npm 11 因上層 monorepo 的 `devEngines.packageManager` 拒絕獨立 Plugin 安裝，可在 `figma-plugin` 目錄執行一次 `npm install --force`。不要在 kanban root 執行 Plugin 的 npm build。

首次匯入：

1. 使用 Figma Desktop 開啟既有設計檔。
2. Canvas 右鍵 → `Plugins` → `Development` → `Import plugin from manifest…`。
3. 選取 `figma-plugin/manifest.json`。
4. 再從 `Plugins` → `Development` 執行 `Flowboard Native Design Generator`。

已匯入時，不要用一般 Community Plugin 搜尋：

1. 關閉一般 Actions／Plugins 搜尋。
2. Canvas 右鍵 → `Plugins` → `Development`。
3. 執行 `Flowboard Native Design Generator`。
4. 確認 UI 版本標記符合目前版本，再按 `Generate All`。

`Generate All` 是結構有變動時的預設選擇；Foundations、Components、Screens 按鈕只用於針對已知範圍快速重建。

## 6. Idempotency 與人工內容

- Generator 只替換帶有自己 pluginData 的 generated root。
- Variables 與 Styles 依名稱更新，避免每次建立重複項目。
- 手動建立、且未帶 Generator pluginData 的節點不得被清除。
- 更新 Generator 後至少連續執行兩次，確認 Page、Section、Component 與 Screen 沒有重複累積。
- 版本造成輸出結構改變時，更新 Plugin UI 可見版本標記與 `figma-plugin/README.md`。

## 7. 完成條件

只有同時通過以下項目，才能說 Figma 設計稿完成：

- `audit-svg-pages.mjs` 通過，Current SVG 沒有多畫面或不可讀問題。
- Plugin TypeScript typecheck 與 production build 成功。
- Figma Desktop 實際執行成功，沒有 runtime error。
- `02 · Components` 中可找到預期的 main components／variants。
- `03 · Screens` 中可找到預期的 Desktop／Mobile 畫面。
- Screen 中的共用 controls 是 Instances，而不是複製的獨立 Frame。
- 畫面與 Current SVG 在層級、間距、文案和 responsive 結構上相符。
- 第二次執行 `Generate All` 不會建立重複 generated roots。

## 8. Current v5 基準

目前 Generator 的可見版本為 `v5`。v3 已驗證可在 Figma Desktop 產生 Workspace Invite；v4 新增 Notification Dropdown；v5 新增工作區邀請回覆：

- `Workspace Invite Dialog / Desktop`
- `Workspace Invite Dialog / Mobile`
- `03 · Screens` → `Workspace Invite` Desktop／Mobile screens
- `Notification Trigger` → Default／Unread／Open variants
- `Notification Item` → Desktop／Mobile × Unread／Read variants
- `Notification Dropdown` → Desktop／Mobile × Default／Loading／Empty／Error variants
- `03 · Screens` → `Notifications` Desktop／Mobile／runtime states screens
- `Workspace Invitation Response` → Desktop／Mobile × Pending／Responding／Accepted／Declined／Error variants
- `Notification Dropdown` → Desktop／Mobile Invitation variants
- `03 · Screens` → `Workspace Invitation Response` Desktop／Mobile／states screens

Workspace Invite 的 Vue 對應為 `shadcn-vue/Dialog`、`shadcn-vue/Button`、`shared/Input` 與 `shared/FormField`。Notification Dropdown 對應 `notifications/NotificationMenu`，底層使用 `shadcn-vue/DropdownMenu`、`Badge`、`ScrollArea` 與 `Skeleton`。

2026-09-11 已在 Figma Desktop 的既有 `Flowboard — Native Design System` 連續執行兩次 v5 `Generate All`。兩次皆成功產生 Foundations、Components 與 Screens；`Workspace Invitation Response` Component Set 可見 Desktop／Mobile 與 Pending／Responding／Accepted／Declined／Error properties，Screens 可找到 Desktop／Mobile／States 且使用 Instances。第二次搜尋結果仍為 Components 4 筆、Screens 13 筆，未累積重複 generated roots；Desktop Screen 已完成 runtime／visual check。
