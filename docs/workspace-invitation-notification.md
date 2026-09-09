# Workspace 邀請與通知

最後核對：2026-09-10（依原始碼與 Backend unit tests）。此文件區分已實作行為與後續目標，不代表完整 HTTP／前端流程已驗收。

## 已實作流程

前端 WorkspaceInviteDialog 呼叫 `POST /workspaceInvitation/invite`，請求由 WorkspaceInvitationController 交給 WorkspaceInvitationService；後者依序：

1. 驗證邀請者具有未封存 Workspace 的 OWNER membership。
2. 依 normalized email 找已註冊受邀者，拒絕邀請自己或既有成員。
3. 查同一工作區／受邀者的 PENDING 邀請；尚有效時回 409。
4. 若舊邀請已到期，用 `id + status=PENDING + expiresAt<=now` 條件更新成 EXPIRED；更新筆數非 1 時回 409。
5. 在同一 Prisma transaction 建立新 Invitation 與 WORKSPACE_INVITED Notification；任一寫入失敗會回滾這兩筆新增。
6. 成功回 201、data null；前端關閉 Dialog 並顯示 toast。

新邀請預設 PENDING、MEMBER，expiresAt 為建立流程計算的 now + 7 天。發送邀請不會建立 WorkspaceMember。

WorkspaceInvitationService 另有尚未公開為 HTTP endpoint 的接受核心 use case。它依 invitationId 取得 workspaceId，確認使用者尚未是 member 且 workspace 未封存，然後在同一 Prisma transaction：

1. 以 `id + inviteeUserId + status=PENDING + expiresAt>now` 條件更新為 ACCEPTED 並寫入 respondedAt。
2. 僅在更新筆數為 1 時建立 WorkspaceMember；狀態已變更、失效或非受邀者都不會建立 membership。

接受 use case 尚未提供 Controller、DTO、shared contract 或前端操作；拒絕與取消也尚未實作。

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

前端通知選單 mount 載入未讀數，每次開啟重新讀取列表與未讀數；支援 loading／error／empty 與重試。現在只能閱讀通知，尚未提供接受／拒絕、標記已讀、下一頁或即時推送。過期通知目前仍會出現在列表與未讀計數。

## 狀態機現況

| 狀態 | 目前程式是否會寫入 |
| --- | --- |
| PENDING | 建立邀請時預設 |
| EXPIRED | 再次邀請遇到已到期的 PENDING 時條件更新 |
| ACCEPTED | Service 接受 use case 的條件更新；尚未有 HTTP endpoint／前端操作 |
| DECLINED | 僅 enum／schema 預留，尚無拒絕流程 |
| CANCELED | 僅 enum／schema 預留，尚無取消流程 |

沒有到期排程；超過 expiresAt 不會自動改變 status。接受成功時會寫入 respondedAt；其他回覆狀態尚未實作。

## 後續交付與驗收

- 補受邀者接受／拒絕 API 與 shared contract：用 Session 身分驗證受邀者；將既有接受 use case 接到 transport 層，並實作拒絕。
- 補重複回覆及接受／拒絕競爭政策，確保只產生一次有效狀態轉移；回覆 API 路徑與重試語意待定。
- 補通知單筆／全部已讀、query DTO、前端回覆與分頁操作。
- Unit tests 已覆蓋 Owner 授權、未知 email、自邀、既有成員、有效／過期邀請、發送 transaction，以及接受 invitation 的核心分支；仍需並行發送與真實資料庫測試。
- 真實資料庫測試邀請／通知 rollback、收件匣隔離與未讀數；完整 E2E 驗證發送 → 受邀者讀取 → 回覆 → 成員清單。
- Session handshake 完成後才加入 commit 後通知 push；HTTP 資料仍是重新同步來源。

2026-09-10 的 `WorkspaceInvitationService` unit spec 已移除 skip，並由 `pnpm test:backend` 執行通過。WorkspaceInvitationController 尚無 spec，NotificationController spec 仍為 skipped；Auth E2E 也尚未涵蓋邀請流程。

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
