export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
export type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER';

/** 創建專案請求 */
export interface CreateProjectRequest {
  name: string;
  description?: string;
  workspaceId: string;
}
/** 新增專案成員請求 */
export interface AddProjectMemberRequest {
  projectId: string;
  memberEmail: string;
  role: ProjectRole;
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
