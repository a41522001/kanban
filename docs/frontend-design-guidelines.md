# Frontend UI 實作守則

本文件定義 Flowboard 前端畫面、元件、樣式與互動規範。Figma 的來源、Generator 操作與驗收另見 [Figma UI 設計稿工作流程](figma-ui-design-workflow.md)。

## 0. Source of truth

發生差異時，依內容種類判斷來源，不把單一 Figma 畫面當成全部規格：

1. API、權限與資料型別：`packages/contracts`、後端 DTO 與對應功能文件。
2. 前端實際元件 API 與互動：`frontend/src`。
3. 顏色、圓角、字體與陰影：`frontend/src/styles/index.css`。
4. 畫面視覺參考：`design/README.md` 列為 Current 的 `design/*.svg`。
5. Figma Canvas：由 `figma-plugin` 重建的可編輯交付物，不是獨立於程式與 SVG 的另一套規格。

## 1. 元件選擇順序

1. 優先使用已安裝的 `shadcn-vue` 元件，例如 Button、Dialog、AlertDialog、DropdownMenu、Badge、Skeleton、ScrollArea 與 Tooltip。
2. `frontend/src/components/ui` 保存 shadcn-vue 基礎元件；除非要統一全站 token 或修正共同行為，否則不在頁面需求中直接改寫它們。
3. `frontend/src/components/common` 保存 Flowboard 跨頁共用的組合元件，例如 FormField、Avatar、UserMenu。組合元件應以 `components/ui` 為基礎，不重做已有的 Dialog、Button 或 DropdownMenu。
4. 僅在 shadcn-vue 沒有對應能力，或 Flowboard 有明確產品語意時建立自訂元件。建立前須先確認不是單一頁面的區塊。
5. 現有 `common/Input.vue` 可繼續作為 Flowboard 的輸入介面；若改採 shadcn-vue Input，應一次規劃遷移，不讓兩套 API 長期並存。

### Figma 與前端元件對應

| Figma component | Vue implementation |
| --- | --- |
| `Button` | `frontend/src/components/ui/button` |
| `Dialog` | `frontend/src/components/ui/dialog` |
| `AlertDialog` | `frontend/src/components/ui/alert-dialog` |
| `DropdownMenu` | `frontend/src/components/ui/dropdown-menu` |
| `Input` | `frontend/src/components/common/Input.vue` + `FormField.vue` |
| `Avatar` | `frontend/src/components/common/Avatar.vue` |
| `Workspace Invite Dialog` | `WorkplaceView` 的 feature composition；底層仍使用 Dialog、Input、Button |
| `Notification Trigger`／`Notification Dropdown` | 建議建立 `common/NotificationMenu.vue`；底層使用 DropdownMenu、Badge、ScrollArea、Skeleton |

設計稿新增重複使用的 control 時，先確認上表與 `frontend/src/components/ui`；不得為同一語意建立第二套 Button、Dialog 或 Input。

## 2. 設計 token

- 顏色、圓角、陰影與字體優先使用 `frontend/src/styles/index.css` 的語意 token，不在頁面任意新增相近色。
- 主要操作使用 `action-primary`；危險操作使用 `feedback-danger`；Kanban 流程狀態使用既有 `flow-*` token。
- 字體以 `Noto Sans TC` 為第一選擇，系統中文字體作 fallback。
- 控制項、Surface 與外框分別使用 `radius-control`、`radius-surface`、`radius-frame`，保持巢狀圓角層級。
- 新 token 必須有跨畫面或明確語意價值，不能只為單一像素差異命名。

## 3. Figma 設計稿

- 所有 Flowboard Figma 畫面必須遵守 [Figma UI 設計稿工作流程](figma-ui-design-workflow.md)，先更新 Current SVG 與既有 Generator，再產生原生 Figma nodes。
- 設計稿必須以實際可落地的 shadcn-vue 元件與既有 Flowboard common 元件為主，不畫出程式端不存在且沒有必要新增的控制項。
- Dialog、Button、Input、Badge 等重複元素使用 Figma component／instance，不複製成彼此無關的圖層。
- Frame 與元件使用 Auto Layout；圖層命名應表達產品語意及對應元件，例如 `Workspace/Invite member dialog`、`Button/Outline`。
- 設計稿中的元件註記應標出對應實作來源，例如 `shadcn-vue/Dialog` 或 `common/FormField`。
- 至少包含 desktop 主狀態；當版面結構會改變時，再補 mobile 版本。Dialog 另需考慮窄螢幕寬度。
- 功能設計必須涵蓋適用的 loading、validation error、server error、empty、disabled 與 success feedback，不能只畫 happy path。
- Figma 的顏色、間距、圓角與文字層級應對應程式 token；設計與程式不同時，先更新本文件或 token，再同步兩邊。

## 4. 頁面與樣式結構

- Vue SFC 順序固定為 `<template>`、`<script setup lang="ts">`、`<style scoped>`。
- 頁面專屬的 Vue、TypeScript 與 CSS 可放在同一個 view 目錄。大型頁面樣式使用 `<style scoped src="./page-name.css">` 引入。
- 頁面 CSS 使用 BEM 命名，例如 `workplace__dialog-footer`；避免 template 堆疊大量只服務單一頁面的 utility class。
- `components/ui` 保留 shadcn-vue 原有組織方式；共用元件若樣式很短，可使用 SFC scoped style 或必要的 utility class，不必為每個小元件額外建立 CSS 檔。
- Tailwind CSS v4 採 CSS-first 設定，不新增 `tailwind.config.js`。
- Import 優先使用 `@/` alias；同一 view 內的 `.css`、測試與 view-specific TypeScript 才使用相對路徑。
- 頁面負責組合與資料流程；可跨頁重用的互動才抽到 `components/common`，shadcn-vue primitive 保留在 `components/ui`。

## 5. 互動與狀態

- 使用者操作的名稱必須一致，例如按鈕使用「傳送邀請」，成功回饋使用「邀請已送出」。
- 表單先做前端基本驗證；後端仍是權限與商業規則的最終判定來源。
- 前端流程只能依穩定 `ApiCode` 判斷，不能比對後端 `message` 字串。
- 提交期間要顯示 loading 並防止重複提交；失敗時保留可修正的輸入內容。
- 成功、一般失敗等短暫回饋使用 Toast；需要使用者確認的危險操作才使用 AlertDialog。
- 動畫只使用在狀態轉換與層級提示，避免高頻操作的裝飾性動畫；並尊重 `prefers-reduced-motion`。
- Dialog 開啟時需鎖定背景互動、將 focus 移入內容，並支援 `Escape` 關閉；送出中若關閉可能造成重複操作，應暫時停用關閉。
- 不把 server `message` 當欄位錯誤來源；validation field errors 對應表單欄位，其餘業務錯誤使用 Toast 或頁面級提示。

## 6. Accessibility 與文字

- 所有互動元素必須支援鍵盤操作並有清楚的 focus-visible 狀態。
- Icon-only button 必須提供可翻譯的 `aria-label`；裝飾 icon 使用 `aria-hidden="true"`。
- 表單錯誤透過 `aria-invalid` 與 `aria-describedby` 連到對應欄位。
- 控制項觸控尺寸以 44px 左右為基準；不能只靠顏色傳達錯誤或狀態。
- 顯示文字一律放入 i18n；範例 Email、工作區名稱等純 placeholder 資料除外。

## 7. 設計到實作流程

1. 確認 API contract、權限與各狀態。
2. 盤點可重用的 shadcn-vue／common 元件與既有 token。
3. 更新 `design/*.svg` visual reference 與 `design/README.md` 的 Current 清單。
4. 更新既有 `figma-plugin`，由 Figma Desktop 產生原生 Components 與 Screens。
5. 依設計實作 responsive、keyboard、loading 與 error 行為。
6. 執行 frontend typecheck、unit test 與 production build；重要流程再補 E2E。
7. 將實作畫面與 Current SVG／Figma Screen 比對後才視為完成。
