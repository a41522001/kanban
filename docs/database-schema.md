# Flowboard 資料庫 Schema

最後檢視：2026-09-08（schema／migration 靜態核對）。

`backend/prisma/schema.prisma` 是資料模型的唯一 source of truth。本文件說明目前資料表的業務意義、關聯、約束與查詢意圖；型別、欄位名稱與 migration 內容應以 Prisma schema 為準。

## 1. 目前範圍

目前已定義五張業務資料表：User、Workspace、WorkspaceMember、Notification、WorkspaceInvitation。

```text
User
├── Workspace (createdBy)
├── WorkspaceMember
├── Notification (recipient)
├── Notification (actor)
└── WorkspaceInvitation (invitee / inviter)

Workspace
├── WorkspaceMember
├── Notification
└── WorkspaceInvitation
```

```text
users ──< workspace_members >── workspaces
  │                                  │
  ├────< notifications (recipient) ──┤
  └────< notifications (actor) ──────┘
```

`Project`、`Board`、`BoardColumn` 與 `Card` 尚未建立資料表。Notification enum 已預留其 resource type，但不代表這些資源已可使用。

## 2. Enum

### `WorkspaceRole`

| 值 | 意義 |
| --- | --- |
| `OWNER` | 可管理工作區設定、成員與邀請。 |
| `MEMBER` | 可進入工作區；具體管理能力由後續 policy 決定。 |

### `NotificationType`

| 值 | 觸發情境 |
| --- | --- |
| `WORKSPACE_INVITED` | 收到工作區邀請。 |
| `WORKSPACE_MEMBER_JOINED` | 有使用者加入工作區。 |
| `PROJECT_MEMBER_ADDED` | 使用者被加入 Project。 |
| `CARD_ASSIGNED` | 卡片被指派給使用者。 |
| `CARD_MENTIONED` | 使用者在卡片或其留言中被提及。 |
| `CARD_REMINDER` | 卡片排程提醒到期。 |

### `NotificationResourceType`

| 值 | `resourceId` 指向 |
| --- | --- |
| `WORKSPACE_INVITATION` | `workspace_invitations.id`（應用層引用，無外鍵）。 |
| `WORKSPACE` | `workspaces.id`。 |
| `PROJECT` | 未來的 `projects.id`。 |
| `BOARD` | 未來的 `boards.id`。 |
| `CARD` | 未來的 `cards.id`。 |

## 3. `users`

帳號主檔。原始密碼不保存，僅保存 `password_hash`。

| 欄位 | 型別 | Null | 說明 |
| --- | --- | --- | --- |
| `id` | UUID | 否 | 使用者主鍵。 |
| `email` | VARCHAR(320) | 否 | 登入帳號；全系統唯一。 |
| `displayName` | VARCHAR(100) | 否 | 介面與通知顯示名稱。 |
| `password_hash` | TEXT | 否 | 密碼雜湊。 |
| `avatar_url` | TEXT | 是 | 使用者頭像 URL。 |
| `created_at` | TIMESTAMP(3) | 否 | 建立時間。 |
| `updated_at` | TIMESTAMP(3) | 否 | 最後更新時間。 |

關聯：一位使用者可建立多個 Workspace、加入多個 Workspace、收到多則 Notification，也可作為多則 Notification 的 actor。

## 4. `workspaces`

公司、團隊或個人工作邊界。例如「無限有限公司」是一個 Workspace；其下未來可有「XX 電商」與「XX 飲料」等 Project。

| 欄位 | 型別 | Null | 說明 |
| --- | --- | --- | --- |
| `id` | UUID | 否 | 工作區主鍵。 |
| `name` | VARCHAR(100) | 否 | 工作區名稱。 |
| `created_by_id` | UUID | 否 | 建立者，參照 `users.id`。 |
| `created_at` | TIMESTAMP(3) | 否 | 建立時間。 |
| `updated_at` | TIMESTAMP(3) | 否 | 最後更新時間。 |
| `archived_at` | TIMESTAMP(3) | 是 | 軟封存時間；null 代表可使用。 |

約束與索引：

- `created_by_id` 外鍵指向 `users.id`，`ON DELETE RESTRICT`。
- index：`created_by_id`、`archived_at`。

## 5. `workspace_members`

使用者進入 Workspace 的 membership。只有 WorkspaceMember 才具備進一步取得 Project／Board 權限的前提。

| 欄位 | 型別 | Null | 說明 |
| --- | --- | --- | --- |
| `id` | UUID | 否 | Membership 的獨立主鍵，供未來角色變更與移除操作使用。 |
| `workspace_id` | UUID | 否 | 所屬工作區，參照 `workspaces.id`。 |
| `user_id` | UUID | 否 | 成員使用者，參照 `users.id`。 |
| `role` | `WorkspaceRole` | 否 | 成員在工作區內的角色；預設 `MEMBER`。 |
| `joined_at` | TIMESTAMP(3) | 否 | 實際成為成員的時間。 |

約束與索引：

- `@@unique([workspaceId, userId])`：同一個使用者在同一個 Workspace 最多一筆 membership。
- index：`user_id`、`workspace_id`。
- Workspace 或 User 被硬刪除時 membership 使用 `ON DELETE CASCADE` 一併刪除。

## 6. `notifications`

使用者的通知收件匣。Notification 是持久化真相；Socket.IO 僅負責即時推送，漏收後仍可由 HTTP API 重新取得。

| 欄位 | 型別 | Null | 說明 |
| --- | --- | --- | --- |
| `id` | UUID | 否 | 通知主鍵與前端列表 key。 |
| `recipient_user_id` | UUID | 否 | 收件者；通知列表、未讀數的主要查詢條件。 |
| `actor_user_id` | UUID | 是 | 觸發通知的使用者；系統排程提醒可為 null。 |
| `workspace_id` | UUID | 是 | 工作區脈絡；系統層級通知可為 null。 |
| `type` | `NotificationType` | 否 | 業務語意，決定前端顯示文案與互動。 |
| `resource_type` | `NotificationResourceType` | 否 | `resource_id` 所指資源的種類。 |
| `resource_id` | UUID | 是 | polymorphic resource pointer；不建立外鍵。 |
| `payload` | JSONB | 否 | 各 type 需要的結構化顯示資料。 |
| `dedupe_key` | VARCHAR(160) | 是 | 同一收件者通知去重 key。 |
| `read_at` | TIMESTAMP(3) | 是 | null 代表未讀。 |
| `expires_at` | TIMESTAMP(3) | 是 | 到期後通知仍保留在歷史列表，但不可再執行資源操作；一般通知為 null。 |
| `created_at` | TIMESTAMP(3) | 否 | 建立時間，也是預設排序依據。 |

約束與索引：

- `@@unique([recipientUserId, dedupeKey])`：同一收件者不能有相同 dedupe key；不同收件者可收到同一事件。PostgreSQL 允許多筆 `dedupe_key = NULL`。
- index：`recipient_user_id, read_at, created_at DESC`，支援未讀篩選與通知列表。
- index：`workspace_id, created_at DESC`，支援工作區脈絡下的通知查詢。
- `recipient_user_id` 使用 `ON DELETE CASCADE`；刪除收件者時一併刪除通知。
- `actor_user_id`、`workspace_id` 使用 `ON DELETE SET NULL`；保留歷史通知，但移除已不存在的脈絡。

### 6.1 `payload` 原則

目標是依各 NotificationType 驗證 payload。目前 Service 對 WORKSPACE_INVITED 驗證 workspaceName／inviterDisplayName 為字串、role=MEMBER；其他類型只檢查是非 null、非 array 的 object，尚無各事件專用 schema。Payload 只保存顯示或導向所需的小型資料。不要存翻譯後文案、邀請 token、Session ID、Email 密碼或其他敏感資料。

例如 `WORKSPACE_INVITED`：

```json
{
  "workspaceName": "無限有限公司",
  "inviterDisplayName": "Jeffery",
  "role": "MEMBER"
}
```

invitation ID 保存於 resourceId；通知過期不會自動標記已讀，目前未讀查詢沒有排除 expiresAt。

## 7. `workspace_invitations`

已建立 schema、migration 與發送邀請流程。Notification 引用 Invitation，並不取代邀請狀態機。

| 欄位 | 型別 | Null | 說明 |
| --- | --- | --- | --- |
| `id` | UUID | 否 | 邀請主鍵。 |
| `workspace_id` | UUID | 否 | 邀請加入的工作區。 |
| `invitee_user_id` | UUID | 否 | 已註冊的受邀使用者。 |
| `inviter_user_id` | UUID | 是 | 邀請者，刪除帳號時清空。 |
| `role` | WorkspaceRole | 否 | 預設 MEMBER，目前建立流程使用預設值。 |
| `status` | WorkspaceInvitationStatus | 否 | 預設 PENDING。 |
| `expires_at` | TIMESTAMP(3) | 否 | 目前 Service 設為 now + 7 天。 |
| `responded_at` | TIMESTAMP(3) | 是 | 回覆時間；現行流程尚未寫入。 |
| `created_at` | TIMESTAMP(3) | 否 | 建立時間。 |
| `updated_at` | TIMESTAMP(3) | 否 | 最後更新時間。 |

WorkspaceInvitationStatus 包含 PENDING、ACCEPTED、DECLINED、CANCELED、EXPIRED。目前只有建立 PENDING 與再次邀請時將過期 PENDING 改為 EXPIRED；接受／拒絕／取消與到期排程尚未實作。

- workspace／invitee 外鍵採 ON DELETE CASCADE，inviter 採 ON DELETE SET NULL。
- 索引：`invitee_user_id, status, created_at DESC`、`workspace_id, status, created_at DESC`、`expires_at`。
- 目前沒有同一工作區／受邀者的 PENDING unique constraint；並行查詢後新增可能產生重複邀請。
- Migration：`backend/prisma/migrations/20260905163548_add_workspaec_invitation/migration.sql`（沿用實際目錄拼字）。

發送邀請的驗證、transaction 範圍與待辦見[邀請與通知](workspace-invitation-notification.md)。

## 8. 後續資料模型

下列是已規劃、但尚未建立的資料表；新增時需同步更新本文件、Prisma schema、contracts、migration 與測試：

- `projects`、`project_members`：Project 與其最小權限邊界。
- `boards`、`board_columns`、`cards`：Kanban read model 與協作指令的持久化資料。
- `reminders`：負責未來排程時間；到期時才建立 `CARD_REMINDER` Notification。
- `outbox_messages`：需要可靠背景投遞與 message queue 時才加入。

## 9. Migration 規則

1. 先修改 `backend/prisma/schema.prisma`。
2. 產生可審閱的 Prisma migration，確認 SQL 的 enum、index、FK 與 delete behavior。
3. migration 成功後，更新本文件的「目前範圍」與 table 說明。
4. 不修改已在共享環境套用過的 migration；新增下一個 migration 修正。
