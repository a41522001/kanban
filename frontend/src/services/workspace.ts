import type { ApiResponse } from '@kanban/contracts/api';
import type {
  CreateWorkspaceDto,
  WorkspaceDto,
  WorkspaceListItemDto,
  WorkspaceMemberDto,
} from '@kanban/contracts/workspaces';
import type { InviteWorkspaceMemberRequest } from '@kanban/contracts/workspaceInvitation';
import api from './http';

export const getWorkspacesApi = async (): Promise<ApiResponse<WorkspaceListItemDto[]>> => {
  const response = await api<ApiResponse<WorkspaceListItemDto[]>>({
    url: '/workspaces',
    method: 'get',
  });

  return response.data;
};

export const createWorkspaceApi = async (
  data: CreateWorkspaceDto,
): Promise<ApiResponse<WorkspaceDto>> => {
  const response = await api<ApiResponse<WorkspaceDto>, CreateWorkspaceDto>({
    url: '/workspaces',
    method: 'post',
    data,
  });

  return response.data;
};

export const getWorkspaceMembersApi = async (
  workspaceId: string,
): Promise<ApiResponse<WorkspaceMemberDto[]>> => {
  const response = await api<ApiResponse<WorkspaceMemberDto[]>>({
    url: `/workspaces/${workspaceId}/members`,
    method: 'get',
  });

  return response.data;
};

export const inviteWorkspaceMemberApi = async (
  data: InviteWorkspaceMemberRequest,
): Promise<ApiResponse<null>> => {
  const response = await api<ApiResponse<null>, InviteWorkspaceMemberRequest>({
    url: '/workspaces/invite',
    method: 'post',
    data,
  });

  return response.data;
};
