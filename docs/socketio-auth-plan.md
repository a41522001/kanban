# Socket.IO 驗證與事件契約計畫

## 1. 目標

- Socket.IO 與 HTTP API 共用同一套 Session 身分來源。
- 伺服器不得信任 client 傳入的 userId、角色或資源擁有者資訊。
- 每個事件都有清楚的 payload、ack、權限檢查與錯誤格式。
- 支援斷線重連、Session 過期與狀態恢復。

## 2. 連線驗證流程

1. 前端建立 Socket.IO connection，瀏覽器自動帶上 Session Cookie。
2. Socket.IO middleware 讀取 handshake headers 中的 Cookie。
3. 解析 Session ID，透過不執行輪轉的 `SessionService.authenticateSocketSession()` 驗證 Redis Session。
4. 驗證成功後，把 userId 與握手時的原始 Session ID 寫入 socket.data，並加入對應的 user 與 Session room。
5. 驗證失敗時拒絕連線；穩定的 error code 與前端 `connect_error` 處理仍待補。

建議型別：

~~~ts
type SocketData = {
  userId: string;
  session: string;
};
~~~

禁止從事件 payload 接受 userId 作為操作身分。事件內一律使用 socket.data.userId。

2026-09-25 核對：`SocketService` 已改用 `authenticateSocketSession()`，握手不會觸發輪轉，也不會產生無法回寫瀏覽器的 Session ID。連線依驗證結果加入 `user:{userId}` 與 `session:{sessionId}` room；登出會嘗試斷開後者。Client 不提供 userId，也不能自行選擇 user room。Workspace View 另以 `workspace:into`／`workspace:leave` 管理 Workspace room，加入前由 server 驗證 membership 與 archivedAt。HTTP 輪轉後既有 Socket 的 room 不會同步更新，詳見 7.2；前端 `connect_error`、Origin 的真實驗證與完整 lifecycle tests 也尚未完成。

## 3. Cookie、CORS 與 Origin

- 前端 Socket.IO client 啟用 withCredentials。
- Backend Socket.IO CORS 只允許設定檔內的 frontend origin。
- Production Cookie 使用 HttpOnly、Secure，以及符合部署方式的 SameSite。
- 若 frontend 與 API 跨站，必須重新評估 SameSite=None、Secure 與 CSRF 防護。
- 不允許使用星號 origin 搭配 credentials。

## 4. 事件與 Ack 契約

每個會修改資料的事件都應回傳 ack，讓前端知道操作是否已提交，而不是只等待 broadcast。

~~~ts
type SocketAck<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: {
        code: string;
        message: string;
        fields?: Record<string, unknown>;
      };
    };
~~~

建議 error code：

- SOCKET_UNAUTHORIZED
- SESSION_EXPIRED
- VALIDATION_FAILED
- RESOURCE_NOT_FOUND
- FORBIDDEN
- VERSION_CONFLICT
- INTERNAL_ERROR

前端邏輯只依賴 code，不應解析 message。

## 5. Room 與權限

- 通知使用 `user:{userId}` room；room 名稱只在 server 端由已驗證的 `socket.data.userId` 組成。
- 目前每條連線另加入 `session:{sessionId}` room，其中 `sessionId` 是握手 Cookie 的原始值。room 僅供 server 端定位連線，不得記錄或對外回傳原始 Session ID。
- Workspace 使用 `workspace:{workspaceId}` room。Client 只能提出 `workspace:into`／`workspace:leave`，Server 在加入前透過 `WorkspacesService.findMembership()` 驗證 userId 對應的有效 WorkspaceMember 與 archivedAt；client 不可自行選擇 user room。
- `workspace:memberChanged` 只傳 `{ workspaceId }` 作為 invalidation signal；目前 Workspace View 收到後重新呼叫成員清單 API。
- Project Board room 命名統一為 `project:{projectId}`；Project 是 Board aggregate root，沒有 Board ID。
- joinBoard 前由 Board 找到 Project，再確認使用者具有有效的 ProjectMember。
- 每一個 mutation event 都再次確認資源權限，不能只依賴已加入 room。
- 離開 `/projects/:projectId` 的 `ProjectView` 時主動 leave 目前 Project room；disconnect 時由 Socket.IO 自動清除連線 room。BoardColumn schema 已建立，但 room 尚未實作，此項仍是目標行為。
- 成功寫入 DB 並 commit 後，才向 room broadcast domain event。

## 6. 重連與資料恢復

Socket.IO 自動重連只代表傳輸層恢復，不代表 client 狀態一定完整。

建議流程：

1. reconnect 後重新驗證 Session。
2. 重新授權並加入目前 `project:{projectId}` room。
3. 傳送 client 已知的 board version 或 lastEventId。
4. 若 server 無法補齊事件，要求 client 重新抓 snapshot。

第一版可採簡化方案：任何重連成功都重新查詢目前 Board snapshot；資料量變大後再導入 event replay。

## 7. Session 過期與登出

- Session 過期：目前只在握手時拒絕新連線；已建立的連線不會因 Redis TTL 到期而自動斷開或重新驗證。
- 使用者登出：目前先從 Redis 撤銷 Cookie 指向的 Session，再斷開同一原始 Session ID 的 room。若該登入尚未輪轉，這可找到對應 Socket；輪轉後會漏掉舊 room，詳見 7.2。
- 若暫時無法維護 Session 到 socketId 的索引，至少讓後續事件重新檢查 Session；安全性較高但 Redis 查詢較多。
- HTTP Session 輪轉後，舊 Session 會保留固定 20 秒 Grace，供已送出的並行請求完成；不能描述成「立即失效」。
- 已建立的 Socket 不會因瀏覽器 Cookie 更新而自動改變 `socket.data`，也不會在每個 event 自動重新握手。敏感 command 是否重新驗證 Session、何時要求 reconnect，必須明確實作。

### 7.1 Socket handshake 不輪轉（已實作）

Socket middleware 使用 `authenticateSocketSession()` 查詢 Current 或 Grace Session，只回傳 userId，不呼叫輪轉；正常 HTTP request 仍由 Guard 執行輪轉並透過 `Set-Cookie` 回傳新 Session ID。這解決了「Socket 握手輪轉成功，卻無法把新 Cookie 傳給瀏覽器」的問題。SessionService 已有對應 unit tests；真實 Socket.IO lifecycle 仍待測。

### 7.2 輪轉後登出漏斷既有 Socket（待修，2026-09-25）

目前 Socket room 以握手時的原始 Session ID 命名，HTTP 輪轉會改變 Cookie，卻不會搬移已連線的 Socket：

1. Socket 帶 Session **A** 連線並加入 `session:A`。
2. HTTP Guard 將 A 輪轉成 **B**，以 `Set-Cookie` 更新瀏覽器；Socket 仍在 `session:A`。
3. 瀏覽器帶 B 登出；`AuthService.logout()` 撤銷 B，`SocketService.disconnectSession(B)` 只斷開 `session:B`。
4. 後端的 `disconnectSession(B)` 不會命中原有 Socket；若前端沒有主動斷線，它可能繼續連線。A 的 Grace Session 在 Redis 到期後，已連線的 Socket 仍不會自動重新驗證。

現行 `session.revokeSession.lua` 只刪除傳入的 Current Session key，沒有一併刪除它記錄的 `previousSessionIdHash`。因此若在輪轉後 20 秒 Grace 期間登出 B，持有 A 的 client 在剩餘 Grace 時間內仍可能通過 HTTP 或 Socket 握手驗證；到期後新握手會失敗，既有 Socket 則可能繼續連線。

目前既有 Socket 可繼續收到 `notification:created`、`workspace:memberChanged`，也可處理 `demo:echo`；`workspace:into` 會檢查 Workspace membership，但不重新檢查 Session。現階段沒有透過 Socket 寫入 Board 的事件。受 SessionGuard 保護、使用已撤銷 B 的 HTTP 請求會被拒絕；若拖曳寫入走這類 HTTP API，此 Socket room 問題不阻擋開發。註冊驗證信與此流程無關。若未來讓 Socket event 直接修改 Board，必須先處理 Session 失效與逐事件授權。

此項暫緩，不將「登出立即使所有既有 Socket 失效」標為完成。修復時：

1. 以同一登入家族穩定不變的 `familyId` 定位 room；`authenticateSocketSession()` 提供 familyId，登出撤銷後斷開同一 family 的 Socket。不要用 `userId` room 斷線，以免影響其他裝置。
2. 撤銷 Current Session 時，以 Redis 原子操作同步刪除其 previous Grace Session，避免 A 在 Grace 期間重新通過驗證。
3. 處理握手驗證與加入 room 之間的競態：加入 room 後重新確認 Session 仍有效，初始化失敗時斷線並處理錯誤。
4. 用真實 Socket.IO client 驗證「A 連線 → HTTP 輪轉成 B → B 登出 → A 的連線斷開且 A/B 都不能重新連線」，並確認同一使用者的另一個登入家族不受影響。

目前使用 Socket.IO 預設 adapter，斷線只涵蓋同一個後端 instance；若部署多個 instance，另需跨 instance 的 adapter 或訊息機制。Redis 儲存 Session 本身不會同步 Socket.IO room。

## 8. Logging

應記錄：

- socket connected、disconnected、join room、leave room
- event name、requestId 或 commandId、projectId、duration、result code
- authentication 或 authorization failure

不得記錄：

- Cookie、Session ID、password、完整 access token
- 完整事件 payload 中的敏感文字

## 9. 測試矩陣

### Connection middleware

- 無 Cookie 時拒絕連線。
- Session 不存在或過期時拒絕連線。
- Session 正常時寫入 socket.data.userId。
- 非允許的 Origin 無法連線。

### Room 與權限

- Project member 可加入該 Project 的 `project:{projectId}` room。
- 非 Project member 無法加入 room。
- Workspace member 可加入未封存 Workspace room；非成員或已封存 Workspace 不可加入。
- Viewer 無法修改卡片。
- 已被移除的成員，即使仍在 room，也無法執行下一個 mutation。

### Event 行為

- 成功時 ack 後產生正確 broadcast。
- validation、forbidden、conflict 回傳穩定 code。
- DB transaction 失敗時不得 broadcast。
- 重複 commandId 不會重複寫入。

### Lifecycle

- 重連後重新加入 room 並取得最新 snapshot。
- 登出後原連線無法繼續操作。
- Session 過期後前端導向登入流程。
- Handshake 遇到已到輪轉時間的 Current Session 時，不會造成「Redis 已輪轉但瀏覽器未取得新 Cookie」。
- A 連線後 HTTP 輪轉為 B，再以 B 登出時，A 的既有連線被斷開，A/B 都無法重新連線；另一個登入家族保持連線。

## 10. 完成條件

- [x] 建立 Socket authentication middleware。
- [x] socket.data 有明確型別。
- [x] Socket handshake 使用不輪轉的 Session 驗證，避免產生無法回寫的 Cookie。
- [ ] HTTP 輪轉後登出可斷開同一登入家族的舊 Socket，並同步撤銷 Previous Grace Session（7.2）。
- [x] 定義目前 client/server event map（echo、notification、Workspace room into／leave／memberChanged）；mutation ack 型別仍待 Board command 階段補上。
- [x] Workspace room subscribe 前驗證 membership 與 archivedAt，接受邀請 commit 後 broadcast `workspace:memberChanged`。
- [ ] join room 與每個 mutation 都有 authorization。
- [ ] 統一 Socket error code 與前端 `connect_error` 處理。
- [ ] 建立 reconnect recovery 流程。
- [ ] connection、permission、event、reconnect 測試通過；目前尚缺真實 Socket.IO clients integration tests。
