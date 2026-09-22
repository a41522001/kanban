import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type {
  CreateProjectRequest,
  ProjectListItemDto,
  ProjectMemberDto,
} from '@kanban/contracts/project';
import {
  createProjectApi,
  getProjectMembersApi,
  getProjectsApi,
  setProjectPinnedApi,
} from '@/services/project';

const sortProjects = (items: ProjectListItemDto[]): ProjectListItemDto[] =>
  [...items].sort((left, right) => {
    if (left.pinnedAt !== null && right.pinnedAt === null) return -1;
    if (left.pinnedAt === null && right.pinnedAt !== null) return 1;

    const pinnedComparison = (right.pinnedAt ?? '').localeCompare(left.pinnedAt ?? '');
    if (pinnedComparison !== 0) return pinnedComparison;

    const updatedComparison = right.updatedAt.localeCompare(left.updatedAt);
    return updatedComparison !== 0 ? updatedComparison : right.id.localeCompare(left.id);
  });

export const useProjectStore = defineStore('projectStore', () => {
  const projects = ref<ProjectListItemDto[]>([]);
  const workspaceId = ref<string | null>(null);
  const selectedProjectId = ref<string | null>(null);
  const membersByProjectId = ref<Record<string, ProjectMemberDto[]>>({});
  const loadingMemberIds = ref(new Set<string>());
  const isLoading = ref(false);
  const hasLoadError = ref(false);
  let listRequestId = 0;
  let generation = 0;
  const pendingMemberRequests = new Map<string, Promise<ProjectMemberDto[]>>();

  const selectedProject = computed(
    () => projects.value.find((project) => project.id === selectedProjectId.value) ?? null,
  );

  const selectProject = (projectId: string | null) => {
    if (projectId === null || projects.value.some((project) => project.id === projectId)) {
      selectedProjectId.value = projectId;
    }
  };

  const loadProjects = async (nextWorkspaceId: string) => {
    const requestId = ++listRequestId;
    workspaceId.value = nextWorkspaceId;
    projects.value = [];
    selectedProjectId.value = null;
    isLoading.value = true;
    hasLoadError.value = false;

    try {
      const response = await getProjectsApi(nextWorkspaceId);
      if (requestId !== listRequestId || workspaceId.value !== nextWorkspaceId) return;

      projects.value = response.data ?? [];
    } catch (error) {
      if (requestId !== listRequestId) return;
      hasLoadError.value = true;
      throw error;
    } finally {
      if (requestId === listRequestId) isLoading.value = false;
    }
  };

  const refreshProjects = async () => {
    const currentWorkspaceId = workspaceId.value;
    const previousSelection = selectedProjectId.value;
    if (!currentWorkspaceId) return;

    await loadProjects(currentWorkspaceId);
    if (previousSelection && projects.value.some(({ id }) => id === previousSelection)) {
      selectedProjectId.value = previousSelection;
    }
  };

  const loadProjectMembers = async (projectId: string, force = false) => {
    if (!force && membersByProjectId.value[projectId]) {
      return membersByProjectId.value[projectId];
    }

    const existing = pendingMemberRequests.get(projectId);
    if (existing) return existing;

    const requestGeneration = generation;
    loadingMemberIds.value.add(projectId);
    const request = getProjectMembersApi(projectId)
      .then((response) => {
        const members = response.data ?? [];
        if (generation === requestGeneration) membersByProjectId.value[projectId] = members;
        return members;
      })
      .finally(() => {
        pendingMemberRequests.delete(projectId);
        loadingMemberIds.value.delete(projectId);
      });

    pendingMemberRequests.set(projectId, request);
    return request;
  };

  const createProject = async (data: CreateProjectRequest) => {
    await createProjectApi(data);
    await loadProjects(data.workspaceId);
    selectedProjectId.value = projects.value[0]?.id ?? null;
  };

  const setProjectPinned = async (projectId: string, pinned: boolean) => {
    await setProjectPinnedApi(projectId, pinned);

    const pinnedAt = pinned ? new Date().toISOString() : null;
    projects.value = sortProjects(
      projects.value.map((project) =>
        project.id === projectId ? { ...project, pinnedAt } : project,
      ),
    );
  };

  const isProjectMembersLoading = (projectId: string) => loadingMemberIds.value.has(projectId);

  const resetProjects = () => {
    generation += 1;
    listRequestId += 1;
    projects.value = [];
    workspaceId.value = null;
    selectedProjectId.value = null;
    membersByProjectId.value = {};
    loadingMemberIds.value.clear();
    pendingMemberRequests.clear();
    isLoading.value = false;
    hasLoadError.value = false;
  };

  return {
    projects,
    workspaceId,
    selectedProjectId,
    selectedProject,
    membersByProjectId,
    isLoading,
    hasLoadError,
    selectProject,
    loadProjects,
    refreshProjects,
    loadProjectMembers,
    createProject,
    setProjectPinned,
    isProjectMembersLoading,
    resetProjects,
  };
});
