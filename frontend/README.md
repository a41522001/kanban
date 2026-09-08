# Flowboard Frontend

Vue 3 + TypeScript + Vite，搭配 Pinia、Vue Router、Tailwind CSS、Reka UI、vue-i18n 與 Axios。以下指令從 monorepo 根目錄執行。

## 設定與指令

建立 `frontend/.env`，設定 `VITE_API_URL=http://localhost:4001`；目前 `.env.example` 為空。後端啟動方式見[根 README](../README.md)。

```sh
pnpm dev:frontend
pnpm --filter frontend build
pnpm --filter frontend type-check
pnpm --filter frontend test:unit --run
pnpm --filter frontend test:e2e
```

Build 同時執行 vue-tsc 與 Vite build；pre scripts 會先編譯共用 contracts。Playwright 指令已配置，但目前只有 scaffold test，不能視為完整 Auth E2E。`pnpm --filter frontend lint` 會自動修正檔案。

## 畫面與資料來源

| 路由 | 行為 |
| --- | --- |
| `/signup` | 註冊帳號；成功後透過提示確認導向登入 |
| `/login` | 登入成功提示確認後重設 User Store，導向 `/workspace` |
| `/workspace` | 真實 Workspace 列表／建立／成員摘要、邀請 Dialog、通知選單；Project 區等待 API |
| `/board` | 看板 UI 與本機假資料，尚未持久化 |

只有 login／signup 是公開路徑；其餘導航會透過 User Store 恢復 Session。尚未配置根路由 redirect 或 catch-all。

## 狀態與 HTTP

- `services/http.ts` 提供單一 Axios client：10 秒 timeout、`withCredentials: true`。
- User Store 快取 userInfo 結果並合併並行 request；失敗也會快取為未登入。
- Workspace Store 保存工作區與目前選取 ID。
- Notification Store 保存通知與未讀數；選單 mount 載入未讀數，開啟時重新讀取列表與未讀數。
- Logout 不論 HTTP 成敗皆清空 User／Workspace／Notification Store 並導向登入；網路失敗不保證伺服器 Session 已撤銷。
- Store reset 尚未阻止舊的 in-flight response 回寫；HTTP 層尚未統一處理一般 API 401。
- Session ID 不放在 localStorage；Socket.IO 尚未整合 Auth lifecycle。
- Google 登入、忘記密碼與帳號設定尚未完成；通知選單目前沒有接受／拒絕或標記已讀操作。

更多說明見 [Auth](../docs/frontend-auth-plan.md)、[邀請與通知](../docs/workspace-invitation-notification.md)、[UI 守則](../docs/frontend-design-guidelines.md)。

文件最後靜態核對：2026-09-08；本次未重新執行 build／tests。
