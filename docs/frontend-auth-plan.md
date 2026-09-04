# Frontend Auth Vertical Slice

> 最後檢視：2026-09-04。核心流程已完成；本文件保留實作決策與尚未納入 MVP 的項目。

## 1. 目標

已完成 Signup、Login、登入狀態恢復、protected route 與 Logout，並正確使用 HttpOnly Session Cookie。

目前 signup 只建立帳號，成功後導向 Login；login 成功後導向 `/board`，並由 route guard 取得 userInfo。

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
→ 清空暫存 User Store
→ 導向 /board，由 route guard 取得 userInfo
~~~

Logout：

~~~text
POST /auth/logout
→ Server 撤銷本次 Cookie 指向的 Session 並清除 Cookie
→ 清空 Auth Store
→ 導向 Login
~~~

## 3. API Client

目前實作的單一 Axios client：
- Base URL 來自 VITE_API_URL。
- 所有 auth request 使用 credentials: include。
- 統一解析 ApiResponse。
- Login／Signup view 使用 Axios error response 解析 backend envelope，將欄位錯誤映射到表單。
- 不在 localStorage 保存 Session ID 或任何 auth token。

尚未抽成共用 `ApiClientError`；現階段由各 view 處理 submit error。若 API 呼叫種類增加，再集中處理：

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

- `/login`、`/signup` 是白名單。
- 其他路徑先透過 `initializeUser()` 驗證；沒有 user 導向 Login。
- Route guard 只透過 Store 取得 session，Store 負責 request 去重。
- 尚未保存原始 redirect target，也尚未讓已登入使用者從 login/signup 自動導向 home。

## 7. Cookie、CORS 與 CSRF

- Development frontend/backend 同為 localhost，不混用 localhost 與 127.0.0.1。
- Fetch 必須使用 credentials: include。
- Backend CORS 只允許 FRONTEND_URL。
- Production Cookie 使用 Secure、HttpOnly、SameSite。
- 若 production frontend/backend 為 cross-site，需重新評估 SameSite=None 與 CSRF protection。
- State-changing endpoint 後續加入 Origin/Referer 檢查或 CSRF token。

## 8. Socket Integration（待辦）

- Auth Store authenticated 後才 connect Socket.IO。
- Logout 時 disconnect。
- connect_error 為 session invalid 時，清空 Auth Store 並導向 Login。
- Reconnect 不從 client payload 傳 userId。

## 9. 測試

- [x] Login／Signup pure form validation。
- [x] User Store session restore 成功、失敗快取、並行 request 去重與 reset。
- [x] Login／Signup submit loading 與 Validation Error 的 UI 處理已實作；尚未有 component test。
- [x] Logout 即使 API 失敗仍會清空本地 User Store 並導向 Login。
- [ ] Route guard redirect target 與已登入 public route redirect。
- [ ] Playwright refresh 後仍維持登入，以及完整登入／登出 flow。
- [ ] 瀏覽器層確認 JavaScript 無法讀取 HttpOnly Cookie。

## 10. 實作狀態

- [x] Axios API client（`withCredentials: true`）。
- [x] User Store session restore 與 request 去重。
- [x] Login API integration。
- [x] Signup API integration。
- [x] Protected route guard。
- [x] Logout。
- [ ] Socket connect/disconnect hook。
- [x] Form validation／User Store unit tests。
- [ ] Login／Signup component tests。
- [ ] Playwright auth flow。

## 11. 驗收條件

- Refresh 後可正確恢復登入狀態。
- 未登入不會短暫看到 protected page。
- 所有 request 正確攜帶 Cookie。
- FieldErrors 可顯示在對應欄位。
- Password、Session ID 不進入 localStorage、Pinia persistence 或 log。
- Logout 後 HTTP 與 Socket 都無法繼續使用舊 Session。

目前 logout 的保證是「本次 Cookie 對應的 Session 無法再使用」。Current／Grace family 的完整撤銷不在 MVP；詳見 `session-architecture.md`。
