import type {
  CreateProjectMemberRequest,
  ProjectRole,
} from '@kanban/contracts/project';

export class CreateProjectMemberDto implements CreateProjectMemberRequest {
  projectId!: string;
  memberEmail!: string;
  role!: ProjectRole;
}
