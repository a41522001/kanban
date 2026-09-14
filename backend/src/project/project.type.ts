import { ProjectRole } from '@kanban/contracts/project';

export interface AddProjectMemberParams {
  projectId: string;
  userId: string;
  role: ProjectRole;
}
