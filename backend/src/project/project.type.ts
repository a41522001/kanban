import { ProjectRole } from '@kanban/contracts/project';

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
}
