# 目前 HTTP API

最後核對：2026-09-16。以 Controllers、DTO、`packages/contracts`、完整 build 與 Backend unit tests 為準；隔離 E2E 沿用 2026-09-15 紀錄。Project／Board 目標規格見 [Board API 與 WebSocket](board-api-websocket-spec.md)。

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
| GET `/workspaceInvitation/:invitationId` | 有效 Session，且為該邀請的受邀者 | UUID path param | 200 / `WorkspaceInvitationDetail`；只回傳本人可查看的邀請 |
| GET `/notifications` | 有效 Session，只查本人收件匣 | 目前無 query DTO | 200 / `{ items, nextCursor }` |
| GET `/notifications/unreadCount` | 有效 Session，只查本人未讀數 | 無 | 200 / `{ count }` |
| PATCH `/notifications/read` | 有效 Session，只能標記本人通知 | `{ notificationId }` | 200 / null；通知不存在或不屬於本人回 404 |
| PATCH `/notifications/readAll` | 有效 Session，只能標記本人通知 | 無 | 200 / number；回傳本次實際標記的筆數，沒有未讀時為 0 |
| POST `/project` | 有效 Session，且為未封存 Workspace 的成員 | `{ name, description?, workspaceId }` | 201 / null，message 為「創建成功」；建立 Project 與 OWNER ProjectMember |
| POST `/project/addMember` | 有效 Session、未封存 Project 的 OWNER；目標帳號必須是同 Workspace 的有效成員 | `{ projectId, memberEmail, role }`，role 僅允許 EDITOR／VIEWER | 201 / null，message 為「新增專案成員成功」；建立 ProjectMember 與通知 |

Logout 若 Redis 操作拋錯，Controller 仍清 Cookie，但錯誤會交由 Filter 回傳，不能保證總是 200。

## Public data

- PublicUser：`email, displayName, avatarUrl`，實際完整型別見 `packages/contracts/user.ts`。
- WorkspaceDto：`id, name, createdAt, updatedAt`。
- WorkspaceListItemDto：上述欄位加 `currentUserRole`。
- WorkspaceMemberDto：`memberId, displayName, avatarUrl, role`；memberId 是 membership UUID。
- WorkspaceInvitationDetail：`invitationId, workspaceId, workspaceName, inviterName, role, status, expiresAt, respondedAt`；詳細型別見 `packages/contracts/workspaceInvitation.ts`。
- PublicNotification：`id, type, resourceType, resourceId, readAt, expiresAt, createdAt`；不包含 recipientUserId、actorUserId、dedupeKey、workspaceId 或 payload。`resourceId` 由 `type + resourceType` 導向對應的 domain detail API。
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

目前 Controller 只傳 recipientUserId。Repository 雖已支援 cursor、limit、type、unreadOnly，但尚未接 query DTO；HTTP 固定使用預設每頁 20 筆，依 createdAt DESC、id DESC 排序。回應有 nextCursor，但目前不能透過 HTTP 傳 cursor 取得下一頁。通知列表只回傳 type 與 resource pointer；WORKSPACE_INVITED 再以 `resourceId` 呼叫 `GET /workspaceInvitation/:invitationId` 取得詳細資訊。

未讀數條件只有 `recipientUserId + readAt = null`，過期通知仍會計入。單筆已讀以 `notificationId + recipientUserId + readAt IS NULL` 條件更新；全部已讀同樣限定目前 Session 的 recipient，兩者皆為冪等操作。通知以 HTTP 載入為持久化真相；邀請建立 transaction commit 後，Socket.IO 會以 `notification:created` 推送 `PublicNotification` 摘要給受邀者目前在線的 user room。前端透過集中式 notification effect／resource sync handler 更新 domain Store：Workspace 已接上，Project／Board／Card 尚為佔位。Socket 斷線或漏收時仍需由前端重新呼叫通知列表與未讀數 API，因目前尚未完成 reconnect resync。

## Project 邊界

建立 Project 時，name 會 trim 且限制 100 字元，description 會 trim、空字串轉為未提供並限制 500 字元，workspaceId 必須是 UUID v4。任一未封存 WorkspaceMember 都可建立 Project；Service 在同一 transaction 建立 Project 與建立者的 `ProjectMember(role=OWNER)`。目前成功回應不回傳新 Project，Project list Repository 也尚未由 HTTP 暴露。

`POST /project/addMember` 是 command-style endpoint，不採邀請接受／拒絕流程。memberEmail 會 trim／lowercase，目標必須是已註冊且仍屬於 Project 所在 Workspace 的使用者；只有未封存 Project 的 OWNER 可操作，且不能透過此 DTO 指派另一個 OWNER。ProjectMember 與 `PROJECT_MEMBER_ADDED` Notification 在同一 transaction 建立，commit 後才向目標使用者的 user room 推送 `notification:created`。`(projectId, userId)` unique constraint 是重複加入的最終併行保護，Prisma P2002 轉為 409。

| 情況 | HTTP status / code |
| --- | --- |
| 建立者不是 WorkspaceMember | 404 / ResourceNotFound (3001) |
| 建立 Project 時 Workspace 已封存 | 400 / RequestError (4000) |
| addMember 操作者不是 Project OWNER、Project 不存在或已封存 | 403 / RequestError (4000) |
| 目標帳號不存在或不是同 Workspace 的有效成員 | 404 / ResourceNotFound (3001) |
| 目標已是 ProjectMember，包含併行 unique conflict | 409 / RequestError (4000) |

## Swagger 與待辦

Swagger 位於 `/api/docs`。現有 Controller 均已標示 domain tag、operation summary、Cookie auth 與主要成功／錯誤狀態，request DTO 也提供欄位描述、格式、enum 與 example。Auth 的手寫 envelope schema 仍把 error 描述為 array，與實際 FieldError object 不一致；可重用 success/error envelope decorators 也尚未完成，因此 Swagger 仍不是完整 response contract 的唯一真相。

尚待補上 Project list／detail／角色調整／移除成員 endpoints、邀請取消、通知 query DTO、共用 Swagger response schema，以及更完整的錯誤授權／併發測試；通知已讀 HTTP endpoint 與對應 E2E 已完成。
