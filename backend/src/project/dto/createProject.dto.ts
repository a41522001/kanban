import type { CreateProjectRequest } from '@kanban/contracts/project';
export class CreateProjectDto implements CreateProjectRequest {
  name!: string;
  description?: string | undefined;
  workspaceId!: string;
}
