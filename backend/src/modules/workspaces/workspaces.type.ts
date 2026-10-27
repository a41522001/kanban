import { WorkspaceRole } from '@kanban/contracts/workspaces';

export interface FindMembershipResponse {
  memberId: string;
  memberName: string;
  role: WorkspaceRole;
  workspaceName: string;
  workspaceArchivedAt: Date | null;
}

export interface FindMembershipByIdResponse {
  memberId: string;
  userId: string;
  workspaceId: string;
  workspaceArchivedAt: Date | null;
}
