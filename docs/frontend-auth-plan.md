# Frontend Auth Vertical Slice 計畫

## 1. 目標

完成 Signup、Login、登入狀態恢復、protected route 與 Logout，正確使用 HttpOnly Session Cookie，並統一處理 backend ApiResponse。

## 2. 資料流

~~~text
App 啟動
→ GET /user/userInfo with credentials
→ 成功：Auth Store 設為 authenticated
→ 401：Auth Store 設為 anonymous
→ 完成初始化後才判斷 protected route
~~~

Login：

~~~text
Login form
→ POST /auth/login
→ Browser 保存 HttpOnly Cookie
→ GET /user/userInfo 或更新 Store
→ 導向原本要前往的頁面
~~~

Logout：

~~~text
POST /auth/logout
→ Server 撤銷目前裝置 Session family 並清除 Cookie
→ 清空 Auth Store
→ 中斷 Socket
→ 導向 Login
~~~

## 3. API Client

建立單一 HTTP client wrapper：
- Base URL 來自 VITE_API_URL。
- 所有 auth request 使用 credentials: include。
- 統一解析 ApiResponse。
- 非 2xx 仍解析 backend envelope。
- Network error、timeout、abort 與 API error 分開表示。
- 不在 localStorage 保存 Session ID 或任何 auth token。

建議型別：

~~~ts
type ApiClientError = {
  status: number | null;
  code: number | null;
  message: string;
  fieldErrors: FieldErrors | null;
  cause: 'api' | 'network' | 'timeout' | 'aborted';
};
~~~

## 4. Auth Store State

~~~ts
type AuthStatus =
  | 'idle'
  | 'restoring'
  | 'authenticated'
  | 'anonymous';
~~~

Store 至少包含：

- status
- currentUser
- isInitialized
- login()
- signup()
- restoreSession()
- logout()
- clear()

不要只使用 boolean isLoggedIn，否則 App 初始化時無法區分尚未查詢與確定未登入。

## 5. Form 行為

### Login

- Submit 時 disable button。
- 防止重複 submit。
- Backend FieldErrors 映射至 email/password。
- Invalid credentials 顯示 general error，不暴露帳號是否存在。
- 完成後清除 password input。

### Signup

- Client validation 僅改善 UX，backend validation 才是安全邊界。
- 顯示 email、password、name、confirmPassword 錯誤。
- confirmPassword 只存在 frontend，不傳給 backend，除非 contract 改變。
- Signup success 後決定自動登入或導向 Login；需明確選一種。

目前 backend signup 只建立帳號，不建立 Session。第一版 frontend 在 signup 成功後導向 Login；若未來改成自動登入，必須同步修改 API contract 與測試。

## 6. Route Guard

- Auth restore 完成前顯示 loading/splash，不立即 redirect。
- Protected route 只允許 authenticated。
- Anonymous 前往 protected route 時記錄 redirect target。
- 已登入前往 login/signup 時導向 application home。
- Route guard 不直接呼叫 API，由 Auth Store 管理 restore 去重。

## 7. Cookie、CORS 與 CSRF

- Development frontend/backend 同為 localhost，不混用 localhost 與 127.0.0.1。
- Fetch 必須使用 credentials: include。
- Backend CORS 只允許 FRONTEND_URL。
- Production Cookie 使用 Secure、HttpOnly、SameSite。
- 若 production frontend/backend 為 cross-site，需重新評估 SameSite=None 與 CSRF protection。
- State-changing endpoint 後續加入 Origin/Referer 檢查或 CSRF token。

## 8. Socket Integration

- Auth Store authenticated 後才 connect Socket.IO。
- Logout 時 disconnect。
- connect_error 為 session invalid 時，清空 Auth Store 並導向 Login。
- Reconnect 不從 client payload 傳 userId。

## 9. 測試

- API client credentials include。
- ApiResponse success/error parsing。
- Auth restore success/401/network error。
- Login loading、field error、invalid credentials。
- Logout 一定清空 local state，即使 API request 失敗也需定義策略。
- Route guard 等待 initialization。
- Playwright refresh 後仍維持登入。
- JavaScript 無法讀取 HttpOnly Cookie。

## 10. 實作順序

- [ ] API client 與 ApiClientError。
- [ ] Auth Store state machine。
- [ ] restoreSession。
- [ ] Login API integration。
- [ ] Signup API integration。
- [ ] Route guard。
- [ ] Logout。
- [ ] Socket connect/disconnect hook。
- [ ] Unit/component tests。
- [ ] Playwright auth flow。

## 11. 驗收條件

- Refresh 後可正確恢復登入狀態。
- 未登入不會短暫看到 protected page。
- 所有 request 正確攜帶 Cookie。
- FieldErrors 可顯示在對應欄位。
- Password、Session ID 不進入 localStorage、Pinia persistence 或 log。
- Logout 後 HTTP 與 Socket 都無法繼續使用舊 Session。

最後一項是完整驗收目標；目前 backend 的 logout 仍只刪除請求攜帶的單一 Session Hash，必須先完成 `session-architecture.md` 所列的 revoke 工作，前端才可依賴此保證。
