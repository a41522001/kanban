import type { Project } from '@/generated/prisma/client';
import type { ProjectRole } from '@kanban/contracts/project';

export interface AddProjectMemberParams {
  projectId: string;
  userId: string;
  role: ProjectRole;
}
export interface FindMembershipResponse {
  memberId: string;
  memberName: string;
  role: ProjectRole;
  projectName: string;
  projectArchivedAt: Date | null;
  workspaceArchivedAt: Date | null;
  workspaceId: string;
}
export type ProjectListItemRecord = Project & {
  pinnedAt: Date | null;
};
