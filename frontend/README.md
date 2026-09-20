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

## 元件結構

`components/ui/` 放基礎 UI primitives；`components/shared/` 放跨功能共用元件；`components/app/` 放 Alert／Loading 等 App shell 元件；`components/account/`、`components/workspace/`、`components/notifications/` 與 `components/board/` 依功能領域分組。需要獨立樣式或測試的元件使用自己的資料夾，讓 `.vue`、`.css` 與 spec 保持內聚；頁面專屬 layout 與樣式則留在對應的 `views/<view>/`。

## 畫面與資料來源

| 路由 | 行為 |
| --- | --- |
| `/signup` | 註冊帳號；成功後透過提示確認導向登入 |
| `/login` | 登入成功提示確認後重設 User Store，導向 `/workspace` |
| `/workspace` | 真實 Workspace 列表／建立／成員摘要、邀請 Dialog、通知選單；Project 列表、建立、搜尋／狀態篩選、成員清單與新增成員 Dialog 已串接 API |
| `/board` | 看板 UI 與本機假資料，尚未持久化 |

只有 login／signup 是公開路徑；其餘導航會透過 User Store 恢復 Session。尚未配置根路由 redirect 或 catch-all。

## 狀態與 HTTP

- `services/http.ts` 提供單一 Axios client：10 秒 timeout、`withCredentials: true`。
- User Store 快取 userInfo 結果並合併並行 request；失敗也會快取為未登入。
- Workspace Store 保存工作區與目前選取 ID。
- Notification Store 保存通知、未讀數、單筆／全部已讀的處理狀態與本次登入期間的邀請回覆狀態；選單 mount 載入未讀數，開啟時重新讀取列表與未讀數。工作區邀請可直接接受或婉拒，成功後會同步標記通知已讀，接受再重新載入工作區清單。
- Project Store 保存目前 Workspace 的 Project list、目前選取 Project、Project members 與 member candidate cache；切換 Workspace 時會忽略過期的 Project response，Project member request 具備去重與快取，新增成員成功後會強制刷新 member cache。
- Logout 不論 HTTP 成敗皆清空 User／Workspace／Notification Store 並導向登入；網路失敗不保證伺服器 Session 已撤銷。
- Store reset 尚未阻止舊的 in-flight response 回寫；一般 API 收到 `Unauthenticated` 已由 Axios interceptor 發出 app event，統一清空 User／Workspace／Notification state 並導向 Login。
- Session ID 不放在 localStorage；protected route 恢復 Session 後會連接 Socket.IO 並啟動通知監聽，登出或 HTTP Session 失效時會停止監聽並斷線。Socket `connect_error`、rotation 與 reconnect resync 尚未完成。
- Google 登入、忘記密碼與帳號設定尚未完成；通知選單尚未提供分頁操作。Backend 通知 read model 未回傳邀請最終狀態，因此整頁重新整理後無法單靠通知資料還原已接受／婉拒 UI。

通知手動驗收（2026-09-12）已確認單筆已讀、全部已讀、接受邀請與婉拒邀請皆可正常完成；已讀操作集中於 `components/notifications/NotificationReadAction/`，並由 Notification Store 統一管理 optimistic 更新、重試與未讀數同步。

更多說明見 [Auth](../docs/frontend-auth-plan.md)、[邀請與通知](../docs/workspace-invitation-notification.md)、[UI 守則](../docs/frontend-design-guidelines.md)。

文件最後核對：2026-09-20。Frontend Vitest 為 13 個 test files／39 tests 通過；Project overview、member cache、notification effect、add-member Dialog 與 member-added notification detail Dialog 均有測試，type-check、production build 與 ESLint 通過。Vite main chunk 為 576.34 kB；read-only Oxlint 尚有 12 個錯誤（9 個 mock 缺明確型別、3 個未使用 type import），因此完整 lint pipeline 尚未全綠，且尚未配置 frontend coverage。Playwright 仍是 Vue starter scaffold，未覆蓋 Auth 或真實 Backend flow。
