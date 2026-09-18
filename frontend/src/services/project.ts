import type { ApiResponse } from '@kanban/contracts/api';
import type {
  CreateProjectRequest,
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
