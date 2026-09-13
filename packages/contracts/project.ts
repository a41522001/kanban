export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
export type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface ProjectListItemDto {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  currentUserRole: ProjectRole;
  createdAt: string;
  updatedAt: string;
}
