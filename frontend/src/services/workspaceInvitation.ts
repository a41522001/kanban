import type { ApiResponse } from '@kanban/contracts/api';
import type { InviteWorkspaceMemberRequest } from '@kanban/contracts/workspaceInvitation';
import api from './http';

export const inviteWorkspaceMemberApi = async (
  data: InviteWorkspaceMemberRequest,
): Promise<ApiResponse<null>> => {
  const response = await api<ApiResponse<null>, InviteWorkspaceMemberRequest>({
    url: '/workspaceInvitation/invite',
    method: 'post',
    data,
  });

  return response.data;
};