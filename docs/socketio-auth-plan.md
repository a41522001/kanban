# Socket.IO 驗證與事件契約計畫

## 1. 目標

- Socket.IO 與 HTTP API 共用同一套 Session 身分來源。
- 伺服器不得信任 client 傳入的 userId、角色或資源擁有者資訊。
- 每個事件都有清楚的 payload、ack、權限檢查與錯誤格式。
- 支援斷線重連、Session 過期與狀態恢復。

## 2. 連線驗證流程

1. 前端建立 Socket.IO connection，瀏覽器自動帶上 Session Cookie。
2. Socket.IO middleware 讀取 handshake headers 中的 Cookie。
3. 解析 Session ID，透過 SessionService 向 Redis 查詢 Session。
4. 驗證成功後，把 userId 寫入 socket.data。
5. 驗證失敗時拒絕連線，前端從 connect_error 取得穩定的 error code。

建議型別：

~~~ts
type SocketData = {
  userId: string;
};
~~~

禁止從事件 payload 接受 userId 作為操作身分。事件內一律使用 socket.data.userId。

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

- Board room 命名統一，例如 board:{boardId}。
- joinBoard 前由 Board 找到 Project，再確認使用者具有有效的 ProjectMember。
- 每一個 mutation event 都再次確認資源權限，不能只依賴已加入 room。
- 離開 Board 頁面時主動 leave room，disconnect 時由 Socket.IO 自動清除連線 room。
- 成功寫入 DB 並 commit 後，才向 room broadcast domain event。

## 6. 重連與資料恢復

Socket.IO 自動重連只代表傳輸層恢復，不代表 client 狀態一定完整。

建議流程：

1. reconnect 後重新驗證 Session。
2. 重新加入目前 Board room。
3. 傳送 client 已知的 board version 或 lastEventId。
4. 若 server 無法補齊事件，要求 client 重新抓 snapshot。

第一版可採簡化方案：任何重連成功都重新查詢目前 Board snapshot；資料量變大後再導入 event replay。

## 7. Session 過期與登出

- Session 過期：server 拒絕新連線或下一次敏感事件，回 SESSION_EXPIRED。
- 使用者登出：刪除 Redis Session，並關閉該 Session 對應的 Socket 連線。
- 若暫時無法維護 Session 到 socketId 的索引，至少讓後續事件重新檢查 Session；安全性較高但 Redis 查詢較多。
- Session rotation 後，舊 Session 必須失效，Socket 需重新連線。

## 8. Logging

應記錄：

- socket connected、disconnected、join room、leave room
- event name、requestId 或 commandId、boardId、duration、result code
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

- Project member 可加入其 Project 下的 Board room。
- 非 Project member 無法加入 room。
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

## 10. 完成條件

- [ ] 建立 Socket authentication middleware。
- [ ] socket.data 有明確型別。
- [ ] 定義 client/server event map 與 ack 型別。
- [ ] join room 與每個 mutation 都有 authorization。
- [ ] 統一 Socket error code。
- [ ] 建立 reconnect recovery 流程。
- [ ] connection、permission、event、reconnect 測試通過。
