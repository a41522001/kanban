# Frontend Auth Vertical Slice

> 更新：2026-09-28。第 1 階段已完成註冊結果 Dialog、未驗證登入導向、驗證提示頁與重寄倒數；點擊信件後的驗證結果頁留待第 2 階段。畫面規劃見 [驗證信設計提案](email-verification-ui-plan.md)。

## 1. 目標

已完成 Signup、Login、登入狀態恢復、protected route 與 Logout，並正確使用 HttpOnly Session Cookie。

目前後端 signup 建立未驗證 LOCAL 帳號並排入寄信工作；前端在 201 後直接顯示信箱提示頁與首次寄送冷卻。login 成功提示確認後導向 `/workspace`，並由 route guard 取得 userInfo。未驗證帳號回 403 / EmailVerificationRequired 後，前端清除密碼、保存回應中的 Email 並進入 /auth/check-email，不自動寄信。

## 2. 資料流

~~~text
首次前往 protected route
→ User Store 呼叫 GET /user/userInfo with credentials
→ 成功：保存 user
→ 失敗（包含 401）：保存 anonymous 結果
→ 同一個頁面生命週期後續導航共用結果，不重複呼叫 API
~~~

Login：

~~~text
Login form
→ POST /auth/login
→ Browser 保存 HttpOnly Cookie
→ 使用者確認成功提示後，清空暫存 User Store
→ 導向 /workspace，由 route guard 取得 userInfo
~~~

Logout：

~~~text
POST /auth/logout
→ Server 撤銷本次 Cookie 指向的 Session 並清除 Cookie
→ 前端 finally 清空 User／Workspace／Notification Store（即使 HTTP 失敗）
→ 導向 Login
~~~

## 3. API Client

目前實作的單一 Axios client：
- Base URL 來自 VITE_API_URL。
- Axios 使用 withCredentials: true，timeout 為 10 秒。
- 各 service 取出 ApiResponse；`getApiErrorResponse()` 會驗證並解析 Axios error envelope，網路錯誤或非本系統 envelope 則回傳 undefined。
- Axios response interceptor 收到 `ApiCode.Unauthenticated` 時發出 `kanban:session-expired` event；App 統一清空 User／Workspace／Notification Store，並在非 Login 頁導向 Login。
- Login／Signup 與邀請 Dialog 使用共用 parser。Validation Error 映射欄位訊息；邀請對象不存在的 `ResourceNotFound` 顯示在 email 欄位。
- 不在 localStorage 保存 Session ID 或任何 auth token。

目前不另包裝成自訂 `ApiClientError`，而是保留 Axios error 供呼叫點決定頁面互動，僅把 envelope 驗證與 session 失效副作用集中於 HTTP 層。若未來需要區分 timeout、取消與網路錯誤，再擴充為：

~~~ts
type ApiClientError = {
  status: number | null;
  code: number | null;
  message: string;
  fieldErrors: FieldErrors | null;
  cause: 'api' | 'network' | 'timeout' | 'aborted';
};
~~~

## 4. User Store State

~~~ts
type UserStore = {
  user: PublicUser | null;
  hasCheckedSession: boolean;
  pendingUserRequest: Promise<PublicUser | null> | null;
};
~~~

Store 至少包含：

- `initializeUser()`：首次呼叫 `GET /user/userInfo`；並行呼叫共用同一個 request。
- `hasCheckedSession`：成功與失敗都會快取，避免受保護路由重複請求。
- `resetUser()`：logout 或登入成功導向前清空快取，確保下一次導航重新取得資料。

Store 不保存 Session ID；瀏覽器自行管理 HttpOnly Cookie。

目前 reset 未取消或忽略 in-flight request，舊 response 仍可能回寫。userInfo 的網路／server error 也會快取為未登入；這些失敗情境仍待補強。一般 API 的 `Unauthenticated` 已統一清空狀態與導向 Login。

## 5. Form 行為

### Login

- Submit 時 disable button。
- 防止重複 submit。
- Backend FieldErrors 映射至 email/password。
- Invalid credentials 顯示 general error，不暴露帳號是否存在。
- 收到 EmailVerificationRequired 時會清除 password；一般帳密錯誤保留表單供修改。登入成功後清除驗證提示頁的暫存。

### Signup

- Client validation 僅改善 UX，backend validation 才是安全邊界。
- 顯示 email、password、name、confirmPassword 錯誤。
- confirmPassword 只存在 frontend，不傳給 backend，除非 contract 改變。
- Signup 201 成功後直接導向 `/auth/check-email`，顯示「驗證信已安排寄送」及後端回傳的倒數；不自動登入。

Backend signup 不建立 Session。SignupView 已依 code=2007 或 emailQueued=false 區分正常入列與排信失敗：兩者都清除密碼並導向信箱提示頁；入列失敗另顯示 Dialog，保留後端倒數以供稍後重寄。Email 重複顯示欄位錯誤；500／網路錯誤不推定帳號未建立。登入回傳 EmailVerificationRequired 時，也進入同一路由，但使用登入未驗證文案。詳細錯誤行為見 [驗證信前端規格](email-verification-ui-plan.md)。

## 6. Route Guard

- `/login`、`/signup`、`/auth/check-email` 以 `meta.public` 標示公開頁；提示頁沒有 Email context 時返回 Login。
- 其他路徑先透過 `initializeUser()` 驗證；沒有 user 導向 Login。
- Project 頁使用 protected route `/projects/:projectId`；目前 `ProjectView` 已讀取 DB Columns，但拖曳順序尚未持久化、Card 尚未實作。
- Route guard 只透過 Store 取得 session，Store 負責 request 去重。
- 尚未保存原始 redirect target，也尚未讓已登入使用者從 login/signup 自動導向 home。

### 驗證信流程進度

- 已新增 `resendVerificationEmailApi`；`verifyEmailApi` 留待第 2 階段。
- `/auth/check-email` 不查 Session、不連 Socket；登入 2005 提供 Email，進頁不自動寄信。
- 重寄中停用提交。202 顯示條件式受理訊息；429 使用後端秒數校正倒數；503 顯示 Dialog 並保留冷卻；400／500／網路失敗顯示 Dialog，不宣稱信一定未寄出。
- Email、入口原因與 retryAt 保存於 sessionStorage；倒數由截止時間計算，重整不中斷，切換 Email 時重設，不保存密碼或 token。
- 第 2 階段仍需新增 `/auth/verify/:token`、缺 token 的 `/auth/verify`、驗證 API 串接及結果分流。
- Login／Signup 的 Google／忘記密碼入口維持既有外觀，後端功能尚未實作。

第 1 階段的 10 個整合式元件測試涵蓋註冊部分成功、2005 導向、context 缺失、重複提交、202／429／503／網路錯誤與倒數恢復。2026-09-28 前端 build 與全部 53 個 Vitest 測試通過；瀏覽器操作使用模擬 API，尚未進行完整真實寄信到驗證的串接驗收。

## 7. Cookie、CORS 與 CSRF

- Development frontend/backend 同為 localhost，不混用 localhost 與 127.0.0.1。
- Fetch 必須使用 credentials: include。
- Backend CORS 只允許 FRONTEND_URL。
- Cookie 的 path 為 /、HttpOnly=true；production 使用 Secure=true、SameSite=None，其餘環境為 Secure=false、SameSite=Lax。
- 若 production frontend/backend 為 cross-site，需重新評估 SameSite=None 與 CSRF protection。
- State-changing endpoint 後續加入 Origin/Referer 檢查或 CSRF token。

## 8. Socket Integration（第一版已完成）

- [x] Protected route 的 User Store 恢復成功後才 connect Socket.IO，並啟動 Notification Store realtime handler。
- [x] Logout 與 HTTP `Unauthenticated` app event 會停止通知 handler、disconnect Socket，並清空 stores。
- [x] Workspace View 依目前選取的 Workspace 加入／離開 `workspace:{workspaceId}` room，收到 `workspace:memberChanged` 後重新取得成員清單。
- [ ] `connect_error` 為 session invalid 時，清空 Auth Store 並導向 Login。
- [x] Reconnect／event payload 不從 client 傳 userId；server 以 handshake Session 建立 `socket.data.userId`。
- [ ] Reconnect 成功後重新加入 Workspace room，並以 HTTP 重新同步通知列表、未讀數與目前 domain read model。
- [ ] 修正 Socket handshake 可能觸發 Session rotation 卻無法回寫新 Cookie 的 lifecycle 風險。

## 9. 測試與 UI 實作

以下項目依 2026-09-20 的 Vitest 結果與 spec 內容核對；標示已實作 UI 不等於已有 component test。

- [x] Login／Signup pure form validation。
- [x] User Store session restore 成功、失敗快取、並行 request 去重與 reset。
- [x] Login／Signup submit loading 與 Validation Error 的 UI 處理已實作；另有第 1 階段整合式元件測試覆蓋未驗證登入與註冊結果分流；完整成功登入流程驗收仍待後續。
- [x] Logout 即使 API 失敗仍會清空本地 User Store 並導向 Login。
- [ ] Route guard redirect target 與已登入 public route redirect。
- [ ] Playwright refresh 後仍維持登入，以及完整登入／登出 flow。
- [ ] 瀏覽器層確認 JavaScript 無法讀取 HttpOnly Cookie。

## 10. 實作狀態

- [x] Axios API client（`withCredentials: true`）。
- [x] User Store session restore 與 request 去重。
- [x] Login API integration。
- [x] Signup API integration，包含 201 部分成功與錯誤分流。
- [x] 驗證提示頁、公開路由、重寄倒數與未驗證登入導向。
- [x] 第 1 階段繁中／英文 i18n 與整合式元件測試。
- [ ] 驗證結果頁與真實註冊到驗證的完整流程驗收。
- [x] Protected route guard。
- [x] Logout。
- [x] Socket connect/disconnect hook 與 Notification realtime handler。
- [x] Form validation／User Store unit tests。
- [x] Login／Signup 第 1 階段結果分流 component tests。
- [ ] Playwright auth flow。

## 11. 驗收條件

- Refresh 後可正確恢復登入狀態。
- 未登入不會短暫看到 protected page。
- 所有 request 正確攜帶 Cookie。
- FieldErrors 可顯示在對應欄位。
- Password、Session ID 不進入 localStorage、Pinia persistence 或 log。
- Logout 後 HTTP 與 Socket 都無法繼續使用舊 Session。

後端 revoke 成功時，僅保證本次 Cookie 對應的 Session 已刪除。網路失敗時，前端清空 Store 不代表伺服器 Session 已失效。Current／Grace family 的完整撤銷不在 MVP；詳見 `session-architecture.md`。
