export type WorkspaceRole = 'OWNER' | 'MEMBER';
export interface CreateWorkspaceDto {
  name: string;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceListItemDto extends WorkspaceDto {
  currentUserRole: WorkspaceRole;
}

export interface WorkspaceMemberDto {
  memberId: string;
  displayName: string;
  avatarUrl: string | null;
  role: WorkspaceRole;
}
