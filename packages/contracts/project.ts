export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
export type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER';
export type AssignableProjectRole = Exclude<ProjectRole, 'OWNER'>;

/** 創建專案請求 */
export interface CreateProjectRequest {
  name: string;
  description?: string;
  workspaceId: string;
}
/** 新增專案成員請求 */
export interface AddProjectMemberRequest {
  projectId: string;
  workspaceMemberId: string;
  role: AssignableProjectRole;
}
export interface ProjectMemberDto {
  memberId: string;
  displayName: string;
  avatarUrl: string | null;
  role: ProjectRole;
}
export interface ProjectListItemDto {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MemberCandidate {
  workspaceMemberId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  projectRole: ProjectRole | null;
}
