import type { ApiResponse } from '@kanban/contracts/api';
import type {
  AcceptOrDeclineInvitationRequest,
  InviteWorkspaceMemberRequest,
  WorkspaceInvitationDetail,
} from '@kanban/contracts/workspaceInvitation';
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

const respondToWorkspaceInvitationApi = async (
  action: 'accept' | 'decline',
  data: AcceptOrDeclineInvitationRequest,
): Promise<ApiResponse<null>> => {
  const response = await api<ApiResponse<null>, AcceptOrDeclineInvitationRequest>({
    url: `/workspaceInvitation/${action}`,
    method: 'post',
    data,
  });

  return response.data;
};

export const acceptWorkspaceInvitationApi = async (
  data: AcceptOrDeclineInvitationRequest,
): Promise<ApiResponse<null>> => {
  return respondToWorkspaceInvitationApi('accept', data);
};

export const declineWorkspaceInvitationApi = async (
  data: AcceptOrDeclineInvitationRequest,
): Promise<ApiResponse<null>> => {
  return respondToWorkspaceInvitationApi('decline', data);
};

export const getWorkspaceInvitationDetailApi = async (
  invitationId: string,
): Promise<ApiResponse<WorkspaceInvitationDetail>> => {
  const response = await api<ApiResponse<WorkspaceInvitationDetail>>({
    url: `/workspaceInvitation/${invitationId}`,
    method: 'get',
  });

  return response.data;
};
