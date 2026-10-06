import type { ApiResponse } from '@kanban/contracts/api';
import type {
  AddProjectMemberRequest,
  CreateProjectRequest,
  MemberCandidate,
  PinnedProjectRequest,
  ProjectMemberAddedNotificationDetail,
  ProjectListItemDto,
  ProjectMemberDto,
} from '@kanban/contracts/project';
import api from './http';

export const getProjectsApi = async (
  workspaceId: string,
): Promise<ApiResponse<ProjectListItemDto[]>> => {
  const response = await api<ApiResponse<ProjectListItemDto[]>>({
    url: `/project/${workspaceId}`,
    method: 'get',
  });

  return response.data;
};

export const setProjectPinnedApi = async (
  projectId: string,
  pinned: boolean,
): Promise<ApiResponse<null>> => {
  const data: PinnedProjectRequest = { pinned };
  const response = await api<ApiResponse<null>, PinnedProjectRequest>({
    url: `/project/${projectId}/pin`,
    method: 'patch',
    data,
  });

  return response.data;
};

export const getProjectMembersApi = async (
  projectId: string,
): Promise<ApiResponse<ProjectMemberDto[]>> => {
  const response = await api<ApiResponse<ProjectMemberDto[]>>({
    url: `/project/${projectId}/members`,
    method: 'get',
  });

  return response.data;
};

export const createProjectApi = async (data: CreateProjectRequest): Promise<ApiResponse<null>> => {
  const response = await api<ApiResponse<null>, CreateProjectRequest>({
    url: '/project',
    method: 'post',
    data,
  });

  return response.data;
};

export const getProjectMemberCandidatesApi = async (
  projectId: string,
): Promise<ApiResponse<MemberCandidate[]>> => {
  const response = await api<ApiResponse<MemberCandidate[]>>({
    url: `/project/${projectId}/memberCandidates`,
    method: 'get',
  });

  return response.data;
};

export const addProjectMemberApi = async (
  data: AddProjectMemberRequest,
): Promise<ApiResponse<null>> => {
  const response = await api<ApiResponse<null>, AddProjectMemberRequest>({
    url: '/project/addMember',
    method: 'post',
    data,
  });

  return response.data;
};

export const getProjectMemberAddedNotificationDetailApi = async (
  notificationId: string,
): Promise<ApiResponse<ProjectMemberAddedNotificationDetail>> => {
  const response = await api<ApiResponse<ProjectMemberAddedNotificationDetail>>({
    url: `/project/notificationDetail/${notificationId}`,
    method: 'get',
  });

  return response.data;
};
