# Workspace 邀請與通知

最後核對：2026-09-11（依原始碼、Backend unit tests、coverage 與 build 核對）。此文件區分已實作行為與後續目標；現有 E2E 在 Node 22 載入排程套件時失敗，不能視為本版本的驗收結果。

## 已實作流程

前端 WorkspaceInviteDialog 呼叫 `POST /workspaceInvitation/invite`，請求由 WorkspaceInvitationController 交給 WorkspaceInvitationService；後者依序：

1. 驗證邀請者具有未封存 Workspace 的 OWNER membership。
2. 依 normalized email 找已註冊受邀者，拒絕邀請自己或既有成員。
3. 查同一工作區／受邀者的 PENDING 邀請；尚有效時回 409。
4. 若舊邀請已到期，用 `id + status=PENDING + expiresAt<=now` 條件更新成 EXPIRED；更新筆數非 1 時回 409。
5. 在同一 Prisma transaction 建立新 Invitation 與 WORKSPACE_INVITED Notification；任一寫入失敗會回滾這兩筆新增。
6. 成功回 201、data null；前端關閉 Dialog 並顯示 toast。

新邀請預設 PENDING、MEMBER，expiresAt 為建立流程計算的 now + 7 天。發送邀請不會建立 WorkspaceMember。

`POST /workspaceInvitation/accept` 以 Session userId 與 body 的 invitationId 呼叫接受 use case。Service 依 invitationId 取得 workspaceId，確認使用者尚未是 member 且 workspace 未封存，然後在同一 Prisma transaction：

1. 以 `id + inviteeUserId + status=PENDING + expiresAt>now` 條件更新為 ACCEPTED 並寫入 respondedAt。
2. 僅在更新筆數為 1 時建立 WorkspaceMember；狀態已變更、失效或非受邀者都不會建立 membership。

`POST /workspaceInvitation/decline` 與接受 API 共用 `AcceptOrDeclineInvitationRequest`／DTO。Service 先確認 invitation 存在且使用者尚未是 member，再以 `id + inviteeUserId + status=PENDING + expiresAt>now` 條件更新為 DECLINED 並寫入 respondedAt；更新筆數為 0 時回 409，且不建立 WorkspaceMember。Backend 接受／拒絕 API 已完成，前端操作與 Owner 取消邀請仍未實作。

`WorkspaceInvitationExpirationJob` 由 `ScheduleModule.forRoot()` 註冊，每分鐘執行一次。它呼叫 service／repository，以 `status=PENDING AND expiresAt<=now` 做 `updateMany`，將所有符合條件的 invitation 更新為 EXPIRED。`waitForCompletion: true` 只避免同一個 Nest process 的重疊執行；多 instance 下仍可能同時掃描，但更新是冪等的。接受／拒絕的條件式更新仍保留 `expiresAt>now`，因此排程尚未跑到的剛過期邀請也不能被回覆。

## Transaction 與併發限制

舊邀請的過期更新在新邀請／通知 transaction 外執行；若後續新增失敗，舊邀請仍會維持 EXPIRED。Owner／membership／PENDING 查詢也在 transaction 外。

目前沒有同一 workspaceId／inviteeUserId 的 PENDING 唯一索引。兩個並行請求可能都通過查詢並各自新增邀請；通知的 dedupeKey 使用新 invitation ID，因此不能防止這種重複邀請。

後續應以資料庫約束與衝突處理保護業務唯一性，並加入真實 PostgreSQL 並行測試；具體 migration／重試政策尚待實作。現有 transaction 只保證邀請與通知一起建立，並不保證前置查詢不受競爭影響。

## 通知資料與讀取

Notification 的 resourceType 為 WORKSPACE_INVITATION，resourceId 指向 invitation.id；dedupeKey 為 `workspaceInvitation:<invitationId>`。Payload 保存：

```json
{
  "workspaceName": "範例工作區",
  "inviterDisplayName": "邀請者",
  "role": "MEMBER"
}
```

invitation ID 位於 resourceId，不重複放進 payload。Service 在建立及 public mapping 時驗證上述 payload 欄位；其他預留通知類型目前只檢查是非 null、非 array 的 object。

前端通知選單 mount 載入未讀數，每次開啟重新讀取列表與未讀數；支援 loading／error／empty 與重試。Backend 已提供接受／拒絕 API，但前端目前仍只能閱讀通知，尚未提供回覆、標記已讀、下一頁或即時推送。過期通知目前仍會出現在列表與未讀計數。

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

- 補 Owner 取消邀請 API，以及前端接受／拒絕／取消操作。
- 補重複接受、非受邀者／未登入回覆，以及接受／拒絕並行競爭測試；目前條件式更新可阻止第二次狀態轉移，但尚未完成完整競爭驗收。
- 補通知單筆／全部已讀、query DTO、前端回覆與分頁操作。
- Unit tests 已覆蓋 Owner 授權、未知 email、自邀、既有成員、有效／過期邀請、發送 transaction，以及接受／拒絕 invitation 的核心分支；`expirePendingInvitations` service delegation 已覆蓋，但 Cron job 本身與真實過期資料的資料庫批次更新仍需測試。
- 真實資料庫測試邀請／通知 rollback、收件匣隔離與未讀數；完整 E2E 驗證發送 → 受邀者讀取 → 回覆 → 成員清單。
- Session handshake 完成後才加入 commit 後通知 push；HTTP 資料仍是重新同步來源。

2026-09-11 執行 `pnpm test:backend:cov`：17 suites、87 tests 通過；WorkspaceInvitationService 已覆蓋發送、接受、拒絕與過期批次 service delegation，Controller spec 已覆蓋 invite／accept／decline。加入 `@nestjs/schedule` 12 後，`pnpm test:backend:e2e` 在本機 Node 22.18／Jest 30 載入 ESM 模組時失敗，尚未重新驗收邀請 suite；NotificationController spec 仍為 skipped。

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
