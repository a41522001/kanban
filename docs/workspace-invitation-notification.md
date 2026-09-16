# Workspace 邀請與通知

最後核對：2026-09-16（依原始碼、完整 build、Frontend type-check／unit tests 核對；Backend coverage 與隔離 Node 24.13 E2E 沿用 2026-09-15 紀錄）。此文件區分已實作行為與後續目標。

## 已實作流程

前端 WorkspaceInviteDialog 呼叫 `POST /workspaceInvitation/invite`，請求由 WorkspaceInvitationController 交給 WorkspaceInvitationService；後者依序：

1. 驗證邀請者具有未封存 Workspace 的 OWNER membership。
2. 依 normalized email 找已註冊受邀者，拒絕邀請自己或既有成員。
3. 查同一工作區／受邀者的 PENDING 邀請；尚有效時回 409。
4. 若舊邀請已到期，用 `id + status=PENDING + expiresAt<=now` 條件更新成 EXPIRED；更新筆數非 1 時回 409。
5. 在同一 Prisma transaction 建立新 Invitation 與 WORKSPACE_INVITED Notification；任一寫入失敗會回滾這兩筆新增。
6. transaction commit 後，由 `SocketService` 向受邀者的 user room 推送 `notification:created`，只傳送 public notification 摘要。
7. 成功回 201、data null；前端關閉 Dialog 並顯示 toast。不存在的已註冊帳號回 404 / `ResourceNotFound`，前端將 server message 顯示在 email 欄位。

新邀請預設 PENDING、MEMBER，expiresAt 為建立流程計算的 now + 7 天。發送邀請不會建立 WorkspaceMember。

`POST /workspaceInvitation/accept` 以 Session userId 與 body 的 invitationId 呼叫接受 use case。Service 依 invitationId 取得 workspaceId，確認使用者尚未是 member 且 workspace 未封存，然後在同一 Prisma transaction：

1. 以 `id + inviteeUserId + status=PENDING + expiresAt>now` 條件更新為 ACCEPTED 並寫入 respondedAt。
2. 僅在更新筆數為 1 時建立 WorkspaceMember；狀態已變更、失效或非受邀者都不會建立 membership。

`POST /workspaceInvitation/decline` 與接受 API 共用 `AcceptOrDeclineInvitationRequest`／DTO。Service 先確認 invitation 存在且使用者尚未是 member，再以 `id + inviteeUserId + status=PENDING + expiresAt>now` 條件更新為 DECLINED 並寫入 respondedAt；更新筆數為 0 時回 409，且不建立 WorkspaceMember。前端通知卡已串接接受／婉拒 API；Owner 取消邀請仍未實作。

`WorkspaceInvitationExpirationJob` 由 `ScheduleModule.forRoot()` 註冊，每分鐘執行一次。它呼叫 service／repository，以 `status=PENDING AND expiresAt<=now` 做 `updateMany`，將所有符合條件的 invitation 更新為 EXPIRED。`waitForCompletion: true` 只避免同一個 Nest process 的重疊執行；多 instance 下仍可能同時掃描，但更新是冪等的。接受／拒絕的條件式更新仍保留 `expiresAt>now`，因此排程尚未跑到的剛過期邀請也不能被回覆。

## Transaction 與併發限制

舊邀請的過期更新在新邀請／通知 transaction 外執行；若後續新增失敗，舊邀請仍會維持 EXPIRED。Owner／membership／PENDING 查詢也在 transaction 外。

目前沒有同一 workspaceId／inviteeUserId 的 PENDING 唯一索引。兩個並行請求可能都通過查詢並各自新增邀請；通知的 dedupeKey 使用新 invitation ID，因此不能防止這種重複邀請。

後續應以資料庫約束與衝突處理保護業務唯一性，並加入真實 PostgreSQL 並行測試；具體 migration／重試政策尚待實作。現有 transaction 只保證邀請與通知一起建立，並不保證前置查詢不受競爭影響。

## 通知資料與讀取

Notification 的 resourceType 為 WORKSPACE_INVITATION，resourceId 指向 invitation.id；dedupeKey 為 `workspaceInvitation:<invitationId>`。Notification 不保存 payload；後續將由 Workspace Invitation detail API 以 resourceId 查詢工作區名稱、邀請者名稱、角色與邀請狀態。

前端通知選單 mount 載入未讀數，每次開啟重新讀取列表與未讀數；支援 loading／error／empty 與重試。每則未讀通知可單筆標記已讀，Dropdown header 可執行全部已讀；處理中會鎖定對應操作，成功後原地更新通知、未讀數與 badge，失敗則保留重試狀態。WORKSPACE_INVITED 通知的 content action 會先標記已讀，再以 resourceId 呼叫詳細資訊 API 並開啟邀請 Dialog；接受／婉拒請求期間鎖定兩個操作，接受成功後重載工作區清單，婉拒後顯示完成狀態。若 API 回 `ResourceNotFound`，代表通知指向的邀請已不存在，Dialog 顯示不可用狀態；其他衝突或網路錯誤則顯示重新載入狀態。一般通知、邀請詳細 Dialog 與已讀操作已拆成可重用元件。全域 Toaster 載入 `vue-sonner/style.css`，toast 使用 fixed overlay，不會參與頁面排版。

邀請回覆狀態以 WorkspaceInvitation 為準；通知選單開啟邀請 UI 時，使用 `resourceId` 呼叫 `GET /workspaceInvitation/:invitationId` 取得詳細資訊，因此通知只負責 unread/read 與導流。使用者點擊 WORKSPACE_INVITED 的內容區時，前端會先呼叫單筆已讀 API，成功後才開啟邀請詳細 Dialog；已讀通知不重複發送請求，已讀 API 失敗則不開啟 Dialog 並保留重試機會。通知已提供單筆／全部已讀 HTTP API 與 `notification:created` 即時推送，但尚未提供 query 分頁；過期通知仍會出現在列表與未讀計數。

### 通知 Socket.IO 推播（第一版已實作）

Socket.IO 只負責把新通知即時送到目前在線的收件者，不取代 Notification 資料表或 HTTP API。工作區邀請與通知先在同一個 PostgreSQL transaction 建立，commit 成功後才向伺服器內部的 `user:{recipientUserId}` room emit；room 名稱由 server 依已驗證的 `socket.data.userId` 建立，client 不可傳入或選擇 userId。transaction rollback 或建立失敗時不得推播。

事件只傳通知摘要與 resource pointer，不傳邀請詳細資料或 payload。事件名稱為 `notification:created`，資料沿用 `PublicNotification`（`id、type、resourceType、resourceId、readAt、expiresAt、createdAt`）。前端收到事件後以 notification id 去重、更新 Pinia 列表與未讀數，再交由集中式 handler 以 `notification.type` 決定 side effect、以 `resourceType + resourceId` 定位 domain resource。Workspace resource sync 已接上 Workspace Store；Project／Board／Card 目前為明確佔位。`WORKSPACE_INVITED` 不會提前刷新 Workspace，只有接受 API 成功後才透過相同 resource sync 重新取得 Workspace 列表。Socket service 目前提供全域 singleton、connect／disconnect 與具名 handler 的 on／off 封裝；protected route 在 userInfo 恢復成功後確保連線，登出或 Session 過期時停止監聽並中斷連線。

這項推播已完成 Session Cookie handshake 與 user room 的第一版。Socket.IO 預設可自動重連，但目前尚未在 reconnect 後主動以 HTTP 重新同步列表／未讀數，也尚未完成事件漏收補償、跨分頁同步與真實多 client integration tests。

## 狀態機現況

| 狀態 | 目前程式是否會寫入 |
| --- | --- |
| PENDING | 建立邀請時預設 |
| EXPIRED | 每分鐘排程批次更新；再次邀請遇到已到期 PENDING 時也會條件更新作為即時 fallback |
| ACCEPTED | `POST /workspaceInvitation/accept` 條件更新，並在同一 transaction 建立 WorkspaceMember |
| DECLINED | `POST /workspaceInvitation/decline` 條件更新，不建立 WorkspaceMember |
| CANCELED | 僅 enum／schema 預留，尚無取消流程 |

排程是 eventual consistency：邀請實體狀態最晚在下一分鐘掃描後才變為 EXPIRED，不保證時間一到立刻變更。接受與拒絕成功時都會寫入 respondedAt；CANCELED 仍未有寫入流程。

## 後續交付與驗收

- 補 Owner 取消邀請 API 與前端操作。
- 補重複接受、非受邀者／未登入回覆，以及接受／拒絕並行競爭測試；目前條件式更新可阻止第二次狀態轉移，但尚未完成完整競爭驗收。
- 補通知 query DTO 與前端分頁操作；單筆／全部已讀的 API 與前端操作已完成。
- Unit tests 已覆蓋 Owner 授權、未知 email、自邀、既有成員、有效／過期邀請、發送 transaction，以及接受／拒絕 invitation 的核心分支；`expirePendingInvitations` service delegation 已覆蓋，但 Cron job 本身與真實過期資料的資料庫批次更新仍需測試。
- 真實資料庫測試邀請／通知 rollback 與跨使用者收件匣隔離；未讀數的單筆／全部已讀 E2E，以及發送 → 受邀者讀取 → 接受／拒絕的 happy paths 已完成。
- Socket.IO Session handshake 與 transaction commit 後通知 push 的第一版已完成；HTTP 資料仍是重新同步來源，後續補斷線重連、去重與漏收同步測試。

2026-09-15 執行 `pnpm test:backend:cov`：17 suites、86 tests 通過，另有 Project 2 suites／2 tests skipped；WorkspaceInvitationService 覆蓋發送、接受、拒絕與過期批次 delegation，Controller spec 覆蓋 invite／accept／decline。隔離 Backend E2E 為 3 suites、5 tests 通過：WorkspaceInvitation suite 驗證接受／拒絕流程，`markReadInvitation` suite 驗證單筆與全部已讀及未讀數變化。

2026-09-15 完整 build 內的 frontend `vue-tsc --build` 與 Vite production build 通過，Vitest 為 8 個 test files、26 tests 通過。2026-09-12 的 ESLint 與 Playwright CLI 攔截 API 驗收仍是最近紀錄；尚未加入連真實 Backend 的 frontend E2E。

2026-09-12 手動驗收前端通知流程：單筆已讀、全部已讀、接受工作區邀請、婉拒工作區邀請皆通過；接受／婉拒成功後通知會同步進入已讀狀態，未讀數與 Bell badge 即時更新。

## 模組依賴

目前依賴已整理為單向：

```text
WorkspaceInvitationModule
└── WorkspacesModule

WorkspaceInvitationService
└── WorkspacesService
    └── WorkspacesRepository
```

`WorkspacesService` 不再注入 `WorkspaceInvitationService`。邀請 endpoint 已改為 `POST /workspaceInvitation/invite`，Controller 位於 WorkspaceInvitationModule。PrismaModule 是 global module；WorkspaceInvitationModule 仍明確 import PrismaModule。
