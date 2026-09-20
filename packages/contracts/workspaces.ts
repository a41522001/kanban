/** 使用者在 Workspace 中的權限角色。 */
export type WorkspaceRole = 'OWNER' | 'MEMBER';

/** 建立 Workspace 時送出的請求資料。 */
export interface CreateWorkspaceDto {
  name: string;
}

/** Workspace 的完整基本資料。 */
export interface WorkspaceDto {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Workspace 列表中的資料，包含目前使用者角色。 */
export interface WorkspaceListItemDto extends WorkspaceDto {
  currentUserRole: WorkspaceRole;
}

/** Workspace 成員列表中的成員資料。 */
export interface WorkspaceMemberDto {
  memberId: string;
  displayName: string;
  avatarUrl: string | null;
  role: WorkspaceRole;
}
