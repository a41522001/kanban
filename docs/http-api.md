# 目前 HTTP API

最後核對：2026-09-12。以 Controllers、DTO、`packages/contracts`、unit tests、build 與 Node 24.13 E2E 為準。Project／Board 目標規格見 [Board API 與 WebSocket](board-api-websocket-spec.md)。

## 基本約定

- 預設 base URL：`http://localhost:4001`，沒有全域 `/api` 前綴。
- 除公開 Auth 端點外，下表受保護的路徑都使用 `sessionId` HttpOnly Cookie。
- SessionGuard 從 Redis 驗證 Cookie，將 userId 放入 request，必要時用 Set-Cookie 輪轉。
- 成功與錯誤皆包成 `{ code, data, message, time, error }`；以下「data」指 envelope 內部資料。
- DTO whitelist、transform、forbidNonWhitelisted 已開啟；詳細錯誤格式見 [API contract](api-contract-plan.md)。

## 已實作端點

| Method / path | 身分與權限 | Request | 成功 status / data |
| --- | --- | --- | --- |
| POST `/auth/signup` | 公開 | `{ email, password, name }` | 201 / null；不建立 Session |
| POST `/auth/login` | 公開 | `{ email, password }` | 200 / null；設定 Session Cookie |
| POST `/auth/logout` | 不套 Guard | 無 body；可帶 Cookie | 200 / null；撤銷本次 token 並清 Cookie |
| GET `/user/userInfo` | 有效 Session | 無 | 200 / PublicUser |
| POST `/workspaces` | 有效 Session | `{ name }` | 201 / WorkspaceDto |
| GET `/workspaces` | 有效 Session | 無 | 200 / WorkspaceListItemDto[] |
| GET `/workspaces/:workspaceId/members` | 有效 Session，且為未封存工作區成員 | UUID path param | 200 / WorkspaceMemberDto[] |
| POST `/workspaceInvitation/invite` | 有效 Session，且為未封存工作區 Owner | `{ workspaceId, email }` | 201 / null，message 為「邀請已送出」 |
| POST `/workspaceInvitation/accept` | 有效 Session，且為該有效 PENDING 邀請的受邀者 | `{ invitationId }` | 200 / null，message 為「已接受邀請」；建立 WorkspaceMember |
| POST `/workspaceInvitation/decline` | 有效 Session，且為該有效 PENDING 邀請的受邀者 | `{ invitationId }` | 200 / null，message 為「已拒絕邀請」；不建立 WorkspaceMember |
| GET `/notifications` | 有效 Session，只查本人收件匣 | 目前無 query DTO | 200 / `{ items, nextCursor }` |
| GET `/notifications/unreadCount` | 有效 Session，只查本人未讀數 | 無 | 200 / `{ count }` |
| PATCH `/notifications/read` | 有效 Session，只能標記本人通知 | `{ notificationId }` | 200 / null；通知不存在或不屬於本人回 404 |
| PATCH `/notifications/readAll` | 有效 Session，只能標記本人通知 | 無 | 200 / number；回傳本次實際標記的筆數，沒有未讀時為 0 |

Logout 若 Redis 操作拋錯，Controller 仍清 Cookie，但錯誤會交由 Filter 回傳，不能保證總是 200。

## Public data

- PublicUser：`email, displayName, avatarUrl`，實際完整型別見 `packages/contracts/user.ts`。
- WorkspaceDto：`id, name, createdAt, updatedAt`。
- WorkspaceListItemDto：上述欄位加 `currentUserRole`。
- WorkspaceMemberDto：`memberId, displayName, avatarUrl, role`；memberId 是 membership UUID。
- PublicNotification：`id, type, workspaceId, resourceType, resourceId, payload, readAt, expiresAt, createdAt`；不包含 recipientUserId、actorUserId、dedupeKey。
- 日期以 ISO 8601 字串回傳；nullable 日期保留 null。

## Workspace 邊界

建立 Workspace 的 name 會 trim，需非空且最多 100 字元。建立者透過 nested create 同時成為 Owner。列表只回本人加入且未封存的工作區。

成員查詢會先檢查呼叫者 membership 與 archivedAt，無存取權回 404。邀請要求 workspaceId 為 UUID v4，email 會 trim／lowercase 並限制 320 字元；業務錯誤如下：

| 情況 | HTTP status / code |
| --- | --- |
| 不是 Owner、無 membership 或工作區封存 | 403 / RequestError (4000) |
| 受邀帳號不存在 | 404 / ResourceNotFound (3001) |
| 邀請自己 | 400 / RequestError (4000) |
| 已是成員、已有有效 PENDING 邀請、過期更新競爭失敗 | 409 / RequestError (4000) |

邀請成功不會直接加入成員。接受與拒絕共用 UUID v4 `invitationId` DTO；找不到 invitation 時回 404 / ResourceNotFound (3001)，其餘非受邀者、已回覆或已過期等條件式更新筆數為 0 時回 409 / RequestError (4000)。接受成功會在同一 transaction 建立 WorkspaceMember；拒絕成功只寫入 DECLINED 與 respondedAt。另有每分鐘執行的背景 job 將已到期 PENDING invitation 改為 EXPIRED；操作端仍自行驗證 expiresAt，不依賴排程已執行。詳見[邀請與通知](workspace-invitation-notification.md)。

## Notification 邊界

目前 Controller 只傳 recipientUserId。Repository 雖已支援 cursor、limit、type、unreadOnly，但尚未接 query DTO；HTTP 固定使用預設每頁 20 筆，依 createdAt DESC、id DESC 排序。回應有 nextCursor，但目前不能透過 HTTP 傳 cursor 取得下一頁。

未讀數條件只有 `recipientUserId + readAt = null`，過期通知仍會計入。單筆已讀以 `notificationId + recipientUserId + readAt IS NULL` 條件更新；全部已讀同樣限定目前 Session 的 recipient，兩者皆為冪等操作。沒有公開建立通知端點，也沒有 Socket.IO 通知推送。

## Swagger 與待辦

Swagger 位於 `/api/docs`，目前 Auth 的手寫 error schema 仍使用 array 描述，與實際 FieldError object 不一致；尚未完成可重用 envelope decorators。不可將 Swagger 視為所有端點完整驗證結果。

尚待補上邀請取消、通知 query DTO，以及更完整的錯誤授權／併發測試與 Swagger；通知已讀 HTTP endpoint 已完成。
