# Flowboard 資料庫 Schema

最後檢視：2026-09-20（依 Prisma schema、9 個 migrations、Project Repository／Service／Controller 與目前測試結果核對；隔離 E2E migration deploy 沿用 2026-09-15 紀錄）。

`backend/prisma/schema.prisma` 是資料模型的唯一 source of truth。本文件說明目前資料表的業務意義、關聯、約束與查詢意圖；型別、欄位名稱與 migration 內容應以 Prisma schema 為準。

## 1. 目前範圍

目前已定義七張業務資料表：User、Workspace、WorkspaceMember、Notification、WorkspaceInvitation、Project、ProjectMember。

```text
User
├── Workspace (createdBy)
├── WorkspaceMember
├── Notification (recipient)
├── Notification (actor)
├── WorkspaceInvitation (invitee / inviter)
├── Project (createdBy)
└── ProjectMember

Workspace
├── WorkspaceMember
├── WorkspaceInvitation
└── Project

Project
└── ProjectMember
```

```text
users ──< workspace_members >── workspaces ──< projects
  │                                  │              │
  ├────< notifications (recipient)   └─< workspace_invitations
  ├────< notifications (actor)
  └────────────< project_members >───────────────────┘
```

`Project` 與 `ProjectMember` 已建立 schema、migration、shared contracts、Repository 與 create／list／members／memberCandidates／addMember API。ProjectService 能在同一 transaction 建立 Project 與建立者的 OWNER membership，也能直接加入同 Workspace 的既有成員並建立通知；Frontend Project overview 與新增成員 Dialog 已串接。Project Controller／隔離 E2E、migration upgrade 與完整併行測試仍待補。`Board`、`BoardColumn` 與 `Card` 仍未建立資料表；Notification enum 已預留這些資源類型，但不代表它們已可使用。

## 2. Enum

### `WorkspaceRole`

| 值 | 意義 |
| --- | --- |
| `OWNER` | 可管理工作區設定、成員與邀請。 |
| `MEMBER` | 可進入工作區；具體管理能力由後續 policy 決定。 |

### `ProjectStatus`

| 值 | 意義 |
| --- | --- |
| `ACTIVE` | 專案進行中，也是建立 Project 時的預設狀態。 |
| `ON_HOLD` | 專案暫停中，仍保留在一般專案資料與權限範圍內。 |
| `COMPLETED` | 專案已完成；不等同封存。 |

`status` 描述專案生命週期，`archived_at` 則控制專案是否從一般列表隱藏，兩者是不同概念。

### `ProjectRole`

| 值 | 意義 |
| --- | --- |
| `OWNER` | 可管理 Project metadata、狀態、成員與 Board。 |
| `EDITOR` | 可操作允許編輯的 Board、Column、Card 與 Project 範圍資源。 |
| `VIEWER` | 只能讀取 Project 與 Board。 |

`ProjectMember.role` 沒有資料庫預設值，建立 membership 時必須由 application service 明確指定角色；建立 Project 時建立者應明確寫入 `OWNER`。

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
| `PROJECT` | `projects.id`（Notification 仍使用 application-level resource pointer，沒有外鍵）。 |
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

關聯：一位使用者可建立多個 Workspace 與 Project、加入多個 Workspace 與 Project、收到多則 Notification，也可作為多則 Notification 的 actor。

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
- 一個 Workspace 可包含多個 Project；Project 的外鍵使用 `ON DELETE RESTRICT`，避免硬刪除仍有 Project 的 Workspace。

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
| `type` | `NotificationType` | 否 | 業務語意，決定前端顯示文案與互動。 |
| `resource_type` | `NotificationResourceType` | 否 | `resource_id` 所指資源的種類。 |
| `resource_id` | UUID | 是 | polymorphic resource pointer；不建立外鍵。 |
| `dedupe_key` | VARCHAR(160) | 是 | 同一收件者通知去重 key。 |
| `read_at` | TIMESTAMP(3) | 是 | null 代表未讀。 |
| `expires_at` | TIMESTAMP(3) | 是 | 到期後通知仍保留在歷史列表，但不可再執行資源操作；一般通知為 null。 |
| `created_at` | TIMESTAMP(3) | 否 | 建立時間，也是預設排序依據。 |

約束與索引：

- `@@unique([recipientUserId, dedupeKey])`：同一收件者不能有相同 dedupe key；不同收件者可收到同一事件。PostgreSQL 允許多筆 `dedupe_key = NULL`。
- index：`recipient_user_id, read_at, created_at DESC`，支援未讀篩選與通知列表。
- `recipient_user_id` 使用 `ON DELETE CASCADE`；刪除收件者時一併刪除通知。
- `actor_user_id` 使用 `ON DELETE SET NULL`；保留歷史通知，但移除已不存在的觸發者。

### 6.1 Notification routing 原則

Notification 不保存 payload。前端先依 `type` 判斷顯示文案與互動，再依 `resourceType + resourceId` 呼叫對應的 domain detail API；`WORKSPACE_INVITED` 的 `resourceId` 指向 `WorkspaceInvitation.id`，`PROJECT_MEMBER_ADDED` 的 `resourceId` 指向 `Project.id`。Project member added 的 detail API 另外要求 notification id 與目前收件者，從 Notification 取得 actor display name，再以收件者的 ProjectMember membership 讀取專案名稱、Workspace 名稱、角色與 joinedAt，避免未授權使用 resource pointer 讀取資料。工作區名稱、邀請者名稱、角色與加入時間都以 domain read model 為準，不在 Notification 重複保存。

通知過期不會自動標記已讀，目前未讀查詢沒有排除 expiresAt。

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
| `responded_at` | TIMESTAMP(3) | 是 | 回覆時間；目前接受與拒絕 invitation 時會寫入。 |
| `created_at` | TIMESTAMP(3) | 否 | 建立時間。 |
| `updated_at` | TIMESTAMP(3) | 否 | 最後更新時間。 |

WorkspaceInvitationStatus 包含 PENDING、ACCEPTED、DECLINED、CANCELED、EXPIRED。目前可建立 PENDING；`WorkspaceInvitationExpirationJob` 每分鐘將已到期 PENDING 批次更新為 EXPIRED，再次邀請發現過期 PENDING 時也會條件更新作為 fallback；透過 HTTP API 可將有效 PENDING 更新為 ACCEPTED 並建立 WorkspaceMember，或更新為 DECLINED 且不建立 membership。取消尚未實作。排程只提供最長約一分鐘的最終一致性，回覆操作仍以 `expires_at > now` 作為真相。

- workspace／invitee 外鍵採 ON DELETE CASCADE，inviter 採 ON DELETE SET NULL。
- 索引：`invitee_user_id, status, created_at DESC`、`workspace_id, status, created_at DESC`、`expires_at`。
- 目前沒有同一工作區／受邀者的 PENDING unique constraint；並行查詢後新增可能產生重複邀請。
- Migration：`backend/prisma/migrations/20260905163548_add_workspaec_invitation/migration.sql`（沿用實際目錄拼字）。

發送邀請的驗證、transaction 範圍與待辦見[邀請與通知](workspace-invitation-notification.md)。

## 8. `projects`

Workspace 之下的專案邊界。ProjectService 的 create flow 會先透過 WorkspacesService 確認 membership 與封存狀態，再於同一 Prisma transaction 建立 Project 與 OWNER ProjectMember；`POST /project` 已對外提供此 command。Project list／detail、前端資料流及有效自動測試尚未完成。

| 欄位 | 型別 | Null | 說明 |
| --- | --- | --- | --- |
| `id` | UUID | 否 | Project 主鍵。 |
| `workspace_id` | UUID | 否 | 所屬 Workspace，參照 `workspaces.id`。 |
| `name` | VARCHAR(100) | 否 | Project 顯示名稱。 |
| `description` | VARCHAR(500) | 是 | Project 的簡短說明。 |
| `status` | `ProjectStatus` | 否 | 專案生命週期；預設 `ACTIVE`。 |
| `created_by_id` | UUID | 否 | 建立者，參照 `users.id`；此欄位保存建立紀錄，不直接代表目前操作權限。 |
| `archived_at` | TIMESTAMP(3) | 是 | 軟封存時間；null 代表未封存。 |
| `created_at` | TIMESTAMP(3) | 否 | 建立時間。 |
| `updated_at` | TIMESTAMP(3) | 否 | 最後更新時間。 |

約束與索引：

- `workspace_id`、`created_by_id` 都使用 `ON DELETE RESTRICT`，避免硬刪除仍被 Project 引用的 Workspace 或建立者。
- index：`workspace_id, archived_at, updated_at DESC`，支援一般 Project 列表與最近更新排序。
- index：`workspace_id, status, archived_at`，支援 Workspace 範圍的狀態篩選。
- index：`created_by_id`，支援依建立者查詢。
- 目前沒有 `workspace_id + name` unique constraint，因此同一 Workspace 可以有同名 Project；API 與前端必須以 UUID 識別。
- `COMPLETED` 不會自動寫入 `archived_at`；完成與封存必須分別處理。

## 9. `project_members`

Project 的最小權限邊界。同一 Project 的所有 Board 共用 ProjectMember，不另外建立 BoardMember。

| 欄位 | 型別 | Null | 說明 |
| --- | --- | --- | --- |
| `id` | UUID | 否 | Membership 獨立主鍵，供角色調整、移除與通知去重引用。 |
| `project_id` | UUID | 否 | 所屬 Project，參照 `projects.id`。 |
| `user_id` | UUID | 否 | 成員使用者，參照 `users.id`。 |
| `role` | `ProjectRole` | 否 | Project 角色；沒有資料庫預設值。 |
| `joined_at` | TIMESTAMP(3) | 否 | 實際加入 Project 的時間。 |

約束與索引：

- `id` 是 UUID primary key；`project_id + user_id` 為 unique constraint，同一使用者在同一 Project 最多一筆 membership。
- index：`user_id`，支援查詢使用者可進入的 Project。
- Project 或 User 被硬刪除時，ProjectMember 使用 `ON DELETE CASCADE` 一併刪除。
- ProjectMember 必須同時是該 Project 所屬 Workspace 的 WorkspaceMember；目前 schema 沒有跨資料表約束，必須由 application service 在 transaction 內驗證。
- 建立 Project 時，Service 會在同一 transaction 建立 Project 與建立者的 `ProjectMember(role=OWNER)`。
- `POST /project/addMember` 會先驗證操作者是未封存 Project 的 OWNER，並確認目標使用者是同一 Workspace 的有效成員；ProjectMember 與 Notification 同 transaction 寫入，`(project_id, user_id)` unique conflict 由 application service 轉為 409。

Project／ProjectMember 初始 migration：`backend/prisma/migrations/20260913135327_add_proejct_and_project_member_data_schema/migration.sql`。目錄中的 `proejct` 是已產生的 migration 名稱拼字；若已套用，不直接更名。獨立 member ID 由 `backend/prisma/migrations/20260915080141_add_project_member_id/migration.sql` 加入。

`20260915080141_add_project_member_id` 直接新增 `UUID NOT NULL id`，SQL 沒有 database default 或既有資料回填。全新資料庫在前一個 migration 建立空表後可套用；已經存在 ProjectMember 資料的環境會失敗。部署到保留既有資料的環境前，必須改成「nullable/default → 回填 → NOT NULL／primary key」的安全 migration，並以真實 PostgreSQL 驗證。

## 10. 後續資料模型

下列是已規劃、但尚未建立的資料表；新增時需同步更新本文件、Prisma schema、contracts、migration 與測試：

- `boards`、`board_columns`、`cards`：Kanban read model 與協作指令的持久化資料。
- `reminders`：負責未來排程時間；到期時才建立 `CARD_REMINDER` Notification。
- `outbox_messages`：需要可靠背景投遞與 message queue 時才加入。

## 11. Migration 規則

1. 先修改 `backend/prisma/schema.prisma`。
2. 產生可審閱的 Prisma migration，確認 SQL 的 enum、index、FK 與 delete behavior。
3. migration 成功後，更新本文件的「目前範圍」與 table 說明。
4. 不修改已在共享環境套用過的 migration；新增下一個 migration 修正。
