# 目前 HTTP API

最後靜態核對：2026-09-28。依 Controllers、Service、DTO、Prisma 與 `packages/contracts` 核對；本次只更新文件，未重新執行 API 或測試。Auth 驗證／重寄已完成，Board 已有部分實作，未完成端點另行標示。功能缺口見[功能盤點](feature-readiness.md)，既有測試紀錄見[進度](progress.md)。

## 基本約定

- 預設 base URL：`http://localhost:4001/v1/api`。2026-10-06 起 `main.ts` 設定全域前綴 `v1/api`（排除 `GET /health`，目前尚未實作），下表路徑皆需加上此前綴，例如 `POST /v1/api/auth/signup`。Socket.IO 不受前綴影響，仍為 `/socket.io/`。E2E 測試未套用前綴。
- 除公開 Auth 端點外，下表受保護的路徑都使用 `sessionId` HttpOnly Cookie。
- SessionGuard 從 Redis 驗證 Cookie，將 userId 放入 request，必要時用 Set-Cookie 輪轉。
- 成功與錯誤皆包成 `{ code, data, message, time, error }`；以下「data」指 envelope 內部資料。
- DTO whitelist、transform、forbidNonWhitelisted 已開啟；詳細錯誤格式見 [API contract](api-contract-plan.md)。
- 使用 `ParseUUIDPipe` 且未指定版本的 path param 接受一般 UUID，並非只接受 v4；格式錯誤會由 Filter 回 400 / RequestError (4000)。DTO 上的 `@IsUUID('4')` 則只接受 v4，驗證失敗回 400 / ValidationError (1000)。

## 已實作端點

| Method / path | 身分與權限 | Request | 成功 status / data |
| --- | --- | --- | --- |
| POST `/auth/signup` | 公開 | `{ email, password, name }` | 201 / `SignupResult`；code 1 或 2007，均不建立 Session |
| POST `/auth/login` | 公開 | `{ email, password }` | 200 / null；已驗證 LOCAL 帳號才設定 Session Cookie |
| POST `/auth/logout` | 不套 Guard | 無 body；可帶 Cookie | 200 / null；撤銷本次 token 並清 Cookie |
| PATCH `/auth/verify/:token` | 公開，不需 Session | URL token；無 body | 200 / null；消耗 token，不建立 Session |
| POST `/auth/resend-verification-email` | 公開，不需 Session | `{ email }` | 202 / `{ retryAfterSeconds }`；條件式受理 |
| GET `/user/userInfo` | 有效 Session | 無 | 200 / PublicUser |
| POST `/workspaces` | 有效 Session | `{ name }` | 201 / WorkspaceDto |
| GET `/workspaces` | 有效 Session | 無 | 200 / WorkspaceListItemDto[] |
| GET `/workspaces/:workspaceId/members` | 有效 Session，且為未封存工作區成員 | UUID path param | 200 / WorkspaceMemberDto[] |
| POST `/workspaceInvitation/invite` | 有效 Session，且為未封存工作區 Owner | `{ workspaceId, email }` | 201 / null，message 為「邀請已送出」 |
| POST `/workspaceInvitation/accept` | 有效 Session，且為該有效 PENDING 邀請的受邀者 | `{ invitationId }` | 200 / null，message 為「已接受邀請」；建立 WorkspaceMember |
| POST `/workspaceInvitation/decline` | 有效 Session，且為該有效 PENDING 邀請的受邀者 | `{ invitationId }` | 200 / null，message 為「已拒絕邀請」；不建立 WorkspaceMember |
| GET `/workspaceInvitation/:workspaceInvitationId` | 有效 Session，且為該邀請的受邀者 | UUID path param | 200 / `WorkspaceInvitationDetail`；只回傳本人可查看的邀請 |
| GET `/notifications` | 有效 Session，只查本人收件匣 | 目前無 query DTO | 200 / `{ items, nextCursor }` |
| GET `/notifications/unreadCount` | 有效 Session，只查本人未讀數 | 無 | 200 / `{ count }` |
| PATCH `/notifications/read` | 有效 Session，只能標記本人通知 | `{ notificationId }` | 200 / null；通知不存在或不屬於本人回 404 |
| PATCH `/notifications/readAll` | 有效 Session，只能標記本人通知 | 無 | 200 / number；回傳本次實際標記的筆數，沒有未讀時為 0 |
| POST `/project` | 有效 Session，且為未封存 Workspace 的成員 | `{ name, description?, workspaceId }` | 201 / null，message 為「創建成功」；建立 Project 與 OWNER ProjectMember |
| GET `/project/:projectId/memberCandidates` | 有效 Session、未封存 Project 與 Workspace 的 Project OWNER | Path `projectId` | 200 / 同 Workspace 成員清單；`projectRole=null` 代表尚未加入 |
| POST `/project/addMember` | 有效 Session、未封存 Project 的 OWNER；目標 membership 必須屬於同一個有效 Workspace | `{ projectId, workspaceMemberId, role }`，role 僅允許 EDITOR／VIEWER | 201 / null，message 為「新增專案成員成功」；建立 ProjectMember 與通知 |
| GET `/project/notificationDetail/:notificationId` | 有效 Session，只能查本人收到且類型正確的 Project member added 通知 | UUID path param | 200 / `ProjectMemberAddedNotificationDetail`；回傳 Project、Workspace、邀請者、角色與加入時間 |
| GET `/project/:projectId/members` | 有效 Session，且為未封存 Project 的 ProjectMember；目前未檢查 Workspace 封存 | UUID path param | 200 / `ProjectMemberDto[]` |
| GET `/project/:workspaceId` | 有效 Session，且為未封存 Workspace 的成員 | UUID path param | 200 / `ProjectListItemDto[]`；只回傳目前使用者所屬且未封存的 Project |
| PATCH `/project/:projectId/pin` | 有效 Session，且為未封存 Project／Workspace 的 ProjectMember | Path `projectId`；body `{ pinned: boolean }` | 200 / null，message 為「更新成功」；只修改目前使用者自己的 `ProjectMember.pinnedAt` |

Logout 若 Redis 操作拋錯，Controller 仍清 Cookie，但錯誤會交由 Filter 回傳，不能保證總是 200。

## Auth API 詳細規格

Email 欄位會 trim 並轉小寫，需符合 Email 格式且最多 320 字元；登入／註冊 password 為 8–72 字元，不 trim。註冊 name 會 trim，非空且最多 100 字元。confirmPassword 與同意條款目前只在前端驗證，不傳給 API；額外 body 欄位回 400 / ValidationError。

所有範例 Email、時間均為假資料。`retryAfterSeconds` 以後端回傳值為準，冷卻由 `RATE_LIMIT_VERIFY_EMAIL_SECONDS` 設定，預設 60 秒。

### POST /auth/signup

Request：`{ "email": "user@example.com", "password": "example-password", "name": "示範使用者" }`。

| 結果 | HTTP / code | data | 前端動作（第 1 階段已實作） |
| --- | --- | --- | --- |
| 帳號建立、工作入列 | 201 / Success (1) | `{ accountCreated: true, emailQueued: true, retryAfterSeconds: 60 }` | 直接進入信箱提示頁，顯示已安排寄送與首次冷卻；完成驗證後前往登入 |
| 帳號建立，但設定冷卻或入列失敗 | 201 / SignupEmailQueueFailed (2007) | `{ accountCreated: true, emailQueued: false, retryAfterSeconds: number }` | 直接進入信箱提示頁並顯示失敗 Dialog；保留後端冷卻，稍後同頁重寄，不重新註冊 |
| Email 已存在（前置查詢） | 409 / EmailAlreadyRegistered (2002) | null | 留在表單，提供登入入口；登入未驗證時再進入重寄提示頁 |
| DTO 錯誤 | 400 / ValidationError (1000) | null | 以 error 顯示欄位錯誤 |
| 建立帳號等未處理例外 | 500 / InternalError (5000) | null | 顯示服務失敗；不能從一般 500 推定帳號建立結果 |

201 的 `emailQueued: true` 只表示 BullMQ 接受工作；SMTP 在 Worker 非同步執行，之後的寄信失敗不會改寫這次 HTTP 回應。201 / 2007 也會走 Axios 的成功分支，前端必須讀取 code 與 data，不能只在 catch 處理排信失敗。排信失敗保留已存在的冷卻；Redis 無法查 TTL 時以設定秒數回傳。

部分成功範例（HTTP 201）：

```json
{
  "code": 2007,
  "data": { "accountCreated": true, "emailQueued": false, "retryAfterSeconds": 60 },
  "message": "帳號已建立，驗證信暫時無法寄送，請稍後重寄",
  "time": "2026-09-27T00:00:00.000Z",
  "error": null
}
```

### POST /auth/login

Request：`{ "email": "user@example.com", "password": "example-password" }`。

| 結果 | HTTP / code | data / 副作用 |
| --- | --- | --- |
| LOCAL 帳號、密碼正確且已驗證 | 200 / Success (1) | null；建立 Session，設定 HttpOnly sessionId Cookie |
| 帳號不存在、非 LOCAL、無密碼或密碼錯誤 | 401 / InvalidCredentials (2001) | null；不建立 Session |
| 密碼正確但 emailVerifiedAt 為 null | 403 / EmailVerificationRequired (2005) | `{ email: "user@example.com" }`；不建立 Session、不設定登入 Cookie |
| DTO 錯誤／服務故障 | 400 / 1000 或 500 / 5000 | null |

前端遇到 2005 應帶回應中的 Email 前往 `/checkEmail`，清除密碼輸入；進頁本身不自動重寄。註冊 201 也會進入同頁，但使用註冊結果文案。2005 不等於 Session 失效的 2003，不應觸發全域 session-expired 清理。

### PATCH /auth/verify/:token

信件 URL 是 `${FRONTEND_URL}/verifyEmail/:token`；前端公開頁面從路由讀 token，再向後端 `PATCH /auth/verify/:token` 送出一次請求，無 request body。驗證期間顯示載入畫面，成功後顯示前往登入；不自動建立 Session。

| 結果 | HTTP / code | data |
| --- | --- | --- |
| 有效 token、符合原 userId 與 Email 的 LOCAL 帳號 | 200 / Success (1) | null |
| token 無效、到期、已消耗、內容缺漏或使用者不符合 | 400 / AuthVerifyFail (2004) | null |
| Redis／DB 操作失敗 | 500 / InternalError (5000) | null |

先更新 DB 再刪 Redis token；已驗證帳號使用另一封仍有效的信也回 200，不重寫驗證時間。同一個 token 消耗後再次使用回 400，不能辨認是已用、過期還是錯誤 token，UI 合併顯示「連結已無法使用」。若 DB 已更新但 DEL 失敗，這次回 500，可重試清理。驗證成功不登入、不改變既有 Session。

目前沒有 token path 的專用 DTO；缺少 token 的 URL 不屬於此 handler，不能依賴後端回 2004。前端 `/verifyEmail` 直接顯示連結不可用，不呼叫 API。2004 與 500／網路錯誤使用不同 Dialog；後者允許手動重試，且不推定連結已失效。

### POST /auth/resend-verification-email

Request：`{ "email": "user@example.com" }`。

| 結果 | HTTP / code | data |
| --- | --- | --- |
| 申請受理 | 202 / Success (1) | `{ retryAfterSeconds: 60 }` |
| 冷卻中 | 429 / EmailVerificationCooldown (2006) | `{ retryAfterSeconds: number }`，剩餘 TTL，最小為 0 |
| 符合條件但入列失敗 | 503 / VerificationEmailQueueFailed (2008) | `{ retryAfterSeconds: number }` |
| DTO 錯誤／Redis 取得資格或查帳號失敗 | 400 / 1000 或 500 / 5000 | null |

所有合法 Email 都先以 Redis SET NX EX 取得冷卻資格，再查帳號；只有未驗證 LOCAL 帳號會入列。不存在、已驗證及 GOOGLE 帳號均回相同 202 與受理文案，且也適用 429 冷卻。202 不保證實際寄信。重寄產生新 token，但不主動取消舊 token；有效期限從各工作寫入 Redis 時計算。

429 範例：

```json
{
  "code": 2006,
  "data": { "retryAfterSeconds": 42 },
  "message": "冷卻中，請稍後再試",
  "time": "2026-09-27T00:00:00.000Z",
  "error": null
}
```

倒數資訊固定放 `data`，沒有 Retry-After header。前端可自行算 `retryAt = Date.now() + retryAfterSeconds * 1000`；retryAt 不是 API 欄位。500／網路錯誤可能無倒數資料，不可視為冷卻已解除。

Auth response 目前沒有 token、jobId、驗證到期時間或 SMTP 寄送狀態。登入 403 也不提供剩餘冷卻秒數；無本機暫存時可顯示寄送按鈕，提交遇到 429 再依回應校正倒數。精確的驗證期限顯示在信件中，前端先使用「請在信件標示的期限內完成驗證」。詳細 Worker 流程見[寄信規格](email-verification-worker-spec.md)。

## Public data

- SignupResult：`accountCreated: true, emailQueued: boolean, retryAfterSeconds: number`。
- ResendVerificationEmailResult：`retryAfterSeconds: number`。
- ProjectMemberDto：`memberId, displayName, avatarUrl, role`；memberId 是 ProjectMember UUID，沒有 joinedAt。
- PublicUser：`email, displayName, avatarUrl`，實際完整型別見 `packages/contracts/user.ts`。
- WorkspaceDto：`id, name, createdAt, updatedAt`。
- WorkspaceListItemDto：上述欄位加 `currentUserRole`。
- WorkspaceMemberDto：`memberId, displayName, avatarUrl, role`；memberId 是 membership UUID。
- WorkspaceInvitationDetail：`invitationId, workspaceId, workspaceName, inviterName, role, status, expiresAt, respondedAt`；詳細型別見 `packages/contracts/workspaceInvitation.ts`。
- ProjectListItemDto：`id, workspaceId, name, description, status, createdAt, updatedAt, pinnedAt`；只包含目前使用者是 ProjectMember 且 Project 未封存的資料，不包含 `currentUserRole`。`pinnedAt` 為 ISO 8601 字串或 null，來自目前使用者自己的 ProjectMember。
- MemberCandidate：`workspaceMemberId, displayName, avatarUrl, projectRole`；前端新增 Project member 時只提交 membership id，不取得內部 userId。
- ProjectMemberAddedNotificationDetail：`role, projectName, projectId, workspaceName, workspaceId, inviterName, joinedAt`；只由通知收件者取得，詳細型別見 `packages/contracts/project.ts`。
- PublicNotification：`id, type, resourceType, resourceId, readAt, expiresAt, createdAt`；不包含 recipientUserId、actorUserId、dedupeKey、workspaceId 或 payload。`resourceId` 由 `type + resourceType` 導向對應的 domain detail API。
- 日期以 ISO 8601 字串回傳；nullable 日期保留 null。

公開 HTTP response 與前端 shared contract 不得包含內部 `User.id`／`userId`。成員相關 UI 必須使用 `workspaceMemberId` 或 `projectMemberId` 等 membership identifier；Backend 由 membership 在 server 內部解析 userId。SessionGuard 寫入 request 的 userId、資料庫關聯與 `user:{userId}` Socket room 都屬於 Backend 內部實作，不是公開 API contract。

## Workspace 邊界

建立 Workspace 的 name 會 trim，需非空且最多 100 字元。建立者透過 nested create 同時成為 Owner。列表只回本人加入且未封存的工作區。

成員查詢會先檢查呼叫者 membership 與 archivedAt，無存取權回 404 / RequestError (4000)，因 Service 拋的是一般 `NotFoundException`。邀請要求 workspaceId 為 UUID v4，email 會 trim／lowercase 並限制 320 字元；業務錯誤如下：

| 情況 | HTTP status / code |
| --- | --- |
| 不是 Owner、無 membership 或工作區封存 | 403 / RequestError (4000) |
| 受邀帳號不存在 | 404 / ResourceNotFound (3001) |
| 邀請自己 | 400 / RequestError (4000) |
| 已是成員、已有有效 PENDING 邀請、過期更新競爭失敗 | 409 / RequestError (4000) |

邀請成功不會直接加入成員。接受與拒絕共用 UUID v4 `invitationId` DTO；找不到 invitation 時回 404 / ResourceNotFound (3001)，其餘非受邀者、已回覆或已過期等條件式更新筆數為 0 時回 409 / RequestError (4000)。接受成功會在同一 transaction 建立 WorkspaceMember；拒絕成功只寫入 DECLINED 與 respondedAt。另有每分鐘執行的背景 job 將已到期 PENDING invitation 改為 EXPIRED；操作端仍自行驗證 expiresAt，不依賴排程已執行。詳見[邀請與通知](workspace-invitation-notification.md)。

## Notification 邊界

目前 Controller 只傳 recipientUserId。Repository 雖已支援 cursor、limit、type、unreadOnly，但尚未接 query DTO；HTTP 固定使用預設每頁 20 筆，依 createdAt DESC、id DESC 排序。回應有 nextCursor，但目前不能透過 HTTP 傳 cursor 取得下一頁。通知列表只回傳 type 與 resource pointer；前端依 `type` 選擇 domain detail API：`WORKSPACE_INVITED` 使用 `resourceId` 呼叫 `GET /workspaceInvitation/:workspaceInvitationId`，`PROJECT_MEMBER_ADDED` 使用 notification id 呼叫 `GET /project/notificationDetail/:notificationId`。

未讀數條件只有 `recipientUserId + readAt = null`，過期通知仍會計入。單筆已讀以 `notificationId + recipientUserId + readAt IS NULL` 條件更新；全部已讀同樣限定目前 Session 的 recipient，兩者皆為冪等操作。通知以 HTTP 載入為持久化真相；邀請與 Project member added 都在 transaction commit 後由 Socket.IO 以 `notification:created` 推送 `PublicNotification` 摘要給收件者目前在線的 user room。接受邀請建立 WorkspaceMember 的 transaction commit 後，另以 `workspace:memberChanged` `{ workspaceId }` 推送給該 Workspace room 的目前訂閱者；前端再呼叫成員清單 API，不把事件 payload 當作完整資料。前端透過集中式 notification effect／resource sync handler 更新 domain Store：Workspace 與 Project 已接上，Board／Card 尚為佔位。Socket 斷線或漏收時仍需由前端重新呼叫通知列表、未讀數或對應 domain API，因目前尚未完成 reconnect resync。

## Project 邊界

建立 Project 時，name 會 trim 且限制 100 字元，description 會 trim、空字串轉為未提供並限制 500 字元，workspaceId 必須是 UUID v4。任一未封存 WorkspaceMember 都可建立 Project；Service 在同一 transaction 建立 Project 與建立者的 `ProjectMember(role=OWNER)`。目前成功回應不回傳新 Project。

`GET /project/:workspaceId` 會先驗證目前使用者是該 Workspace 的有效成員，再透過 `workspaceId + userId` 查詢其所屬且未封存的 Project。Project 的 `status` 不作額外過濾，因此 `ACTIVE`、`ON_HOLD`、`COMPLETED` 都可能回傳。排序固定為目前 membership 的 `pinnedAt DESC NULLS LAST`，再依 Project `updatedAt DESC, id DESC`；不同使用者可以對同一個 Project 有不同排序。

`PATCH /project/:projectId/pin` 接受 `{ pinned: true }` 或 `{ pinned: false }`。`true` 會把目前成員的 `pinnedAt` 寫成 Server UTC 現在時間，`false` 會寫回 null。這是 membership preference，不修改 Project、其他成員或 `Project.updatedAt`；任何仍有效的 ProjectMember 都能管理自己的置頂狀態，不要求 OWNER。前端成功後以本機時間 optimistic 更新並用相同規則重排，重新載入列表時以 Server 回傳的 `pinnedAt` 為準。

`GET /project/:projectId/memberCandidates` 提供新增成員 UI 的 read model，列出 Project 所屬 Workspace 的成員；`projectRole` 為 `null` 表示可加入，非 `null` 表示已加入並供前端停用。此清單只開放 Project OWNER，且封存的 Project／Workspace 不可存取。

`POST /project/addMember` 是 command-style endpoint，不採邀請接受／拒絕流程。`workspaceMemberId` 必須指向 Project 所在 Workspace 的有效 membership；只有未封存 Project 的 OWNER 可操作，且 shared contract 與 runtime DTO 都只允許 `EDITOR`／`VIEWER`。ProjectMember 與 `PROJECT_MEMBER_ADDED` Notification 在同一 transaction 建立，通知使用 `resourceType=PROJECT`、`resourceId=projectId`，commit 後才向目標使用者的 user room 推送 `notification:created`。`(projectId, userId)` unique constraint 是重複加入的最終併行保護，Prisma P2002 轉為 409。

`GET /project/notificationDetail/:notificationId` 會先以 `notificationId + recipientUserId` 查詢收件者自己的通知，再確認 `type=PROJECT_MEMBER_ADDED`、`resourceType=PROJECT` 與 `resourceId` 存在；接著用收件者的 ProjectMember membership 讀取 Project、Workspace 與 joinedAt。通知不存在、不是本人通知、類型／資源不符、成員不存在，或 Project／Workspace 已封存時，皆回 404 / `ResourceNotFound`。因此前端不會直接信任通知列表的 resource pointer 作為完整授權依據。

前端點擊 `PROJECT_MEMBER_ADDED` 通知內容時，流程為「標記單筆已讀 → 關閉 Notification Dropdown → 呼叫 detail API → 開啟 Project Member Added Notification Detail Dialog」。Dialog 顯示邀請者、專案、工作區、Project role 與加入時間；載入中使用 skeleton，API 失敗提供 retry；成功後的「前往專案」導向 `/projects/:projectId` 的 `ProjectView`，並以 `workspaceId` query 保留 Workspace context。

| 情況 | HTTP status / code |
| --- | --- |
| 建立者不是 WorkspaceMember | 404 / ResourceNotFound (3001) |
| 建立 Project 時 Workspace 已封存 | 400 / RequestError (4000) |
| addMember 操作者不是 Project OWNER、Project 不存在或已封存 | 403 / RequestError (4000) |
| 目標 Workspace membership 不存在、已失效或屬於其他 Workspace | 404 / ResourceNotFound (3001) |
| 目標已是 ProjectMember，包含併行 unique conflict | 409 / RequestError (4000) |
| pin 操作者不是有效 ProjectMember，或 Project／Workspace 已封存 | 403 / RequestError (4000) |
| pin body 不是 boolean 或含額外欄位 | 400 / ValidationError (1000) |
| pin 通過 membership 檢查但更新筆數為 0 | 400 / RequestError (4000) |

Project list 的存取錯誤如下：

| 情況 | HTTP status / code |
| --- | --- |
| 不是 WorkspaceMember 或找不到 Workspace | 404 / ResourceNotFound (3001) |
| Workspace 已封存 | 400 / RequestError (4000) |

## Board：已存在但尚未完成的 API

以下路徑已掛載於 BoardModule，均套 SessionGuard。它們目前不是完整 Board snapshot／拖曳 contract，應先處理下列缺口再依其設計協作互動。

| Method / path | Request | 現況 response | 完成程度 |
| --- | --- | --- | --- |
| GET `/board/:projectId` | UUID path param | 200 / `BoardColumn[]` | 已查 DB，尚缺 Project membership 與 Project／Workspace archivedAt 授權檢查 |
| POST `/board/addColumn` | `{ projectId, title, colorKey }` | 201 / `{ column, boardRevision: string }` | 已檢查有效 Project OWNER／EDITOR，transaction 新增 Column 並遞增 revision |
| PATCH `/board/moveColumn` | 型別定義有 projectId、columnId、beforeColumnId、afterColumnId、expectedBoardRevision | handler 是 200 / null 佔位 | 未呼叫 Service、未更新排序、未檢查 revision；DTO 無 validation decorators，非空 body 會被全域 whitelist 拒絕 |

目前 BoardColumn 直接回傳 Prisma 資料：`id, projectId, title, colorKey, position, version, archivedAt, createdAt, updatedAt`，尚無 shared response DTO。GET 只過濾 Column.archivedAt=null，依 position ASC、updatedAt DESC 排序；不含 Project metadata、boardRevision 或 cards。找不到 Columns 時回空陣列。**目前只要通過 SessionGuard 並提供 Project ID 即可查其未封存 Columns，授權尚未完成。**

新增 Column 的 projectId 必須 UUID v4；title trim、非空且最多 80 字元；colorKey 限 coral／mint／amber／violet。position 設為未封存欄位的最大值加 1024（空集合從 1024 開始）。無 membership、VIEWER、Project 或 Workspace 已封存回 403 / RequestError；DTO 錯誤回 400 / ValidationError。

前端 ProjectView 已呼叫 GET `/board/:projectId`，含載入／空清單／失敗重試；cards 暫填空陣列。VueDraggable 只更改本機順序，重新載入會回到 DB 順序。Card schema／API、Column 更新／封存、持久化拖曳及 project room 同步尚未完成。`GET /project/:projectId/board` 仍是[目標規格](board-api-websocket-spec.md)，不能當作現有路徑。

Project 成員清單補充：`GET /project/:projectId/members` 無 membership 或 Project 已封存時拋一般 NotFoundException，經 Filter 回 404 / RequestError (4000)，目前不是 ResourceNotFound (3001)；Service 尚未拒絕 Workspace 已封存的情況。

## Swagger 與待辦

Swagger 位於 `/api/docs`。既有 Auth／User／Workspace／Invitation／Notification／Project 多數端點已有基本 metadata；Auth 驗證 handler、Project members／notification detail／pin 與 Board handlers 仍缺完整 endpoint-specific metadata。驗證／重寄的完整錯誤 data schema、signup 的 201 / 2007 分支也尚未完整列在 Swagger 中。

Auth 手寫 error schema 已改為 object，但 additionalProperties 仍描述成字串陣列，實際應是 `{ value, messages }` 的 FieldError。可重用 typed response decorators 尚未完成，因此目前以本文件、contracts 和執行程式共同核對 API，不把 Swagger 視為完整唯一真相。

尚未實作的功能包括：Google OAuth、忘記／重設密碼、修改帳號 Email、寄信狀態查詢、通知 query DTO、邀請取消、Workspace／Project 成員角色調整與移除、Project detail／編輯／封存、完整 Board snapshot、Card API 與協作拖曳。分批優先順序與 SVG 設計邊界見[設計前功能盤點](feature-readiness.md)。
