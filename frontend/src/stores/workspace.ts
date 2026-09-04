import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { WorkspaceListItemDto } from '@kanban/contracts/workspaces';
import { createWorkspaceApi, getWorkspacesApi } from '@/services/workspace';

export const useWorkspaceStore = defineStore('workspaceStore', () => {
  const workspaces = ref<WorkspaceListItemDto[]>([]);
  const selectedWorkspaceId = ref<string | null>(null);
  const isLoading = ref(false);
  const hasLoadError = ref(false);
  let pendingWorkspacesRequest: Promise<void> | null = null;

  const selectedWorkspace = computed(() => {
    return workspaces.value.find((workspace) => workspace.id === selectedWorkspaceId.value) ?? null;
  });

  const selectWorkspace = (workspaceId: string) => {
    if (workspaces.value.some((workspace) => workspace.id === workspaceId)) {
      selectedWorkspaceId.value = workspaceId;
    }
  };

  const loadWorkspaces = async () => {
    if (pendingWorkspacesRequest) {
      return pendingWorkspacesRequest;
    }

    isLoading.value = true;
    hasLoadError.value = false;

    pendingWorkspacesRequest = getWorkspacesApi()
      .then((response) => {
        workspaces.value = response.data ?? [];

        const stillSelected = workspaces.value.some(
          (workspace) => workspace.id === selectedWorkspaceId.value,
        );

        if (!stillSelected) {
          selectedWorkspaceId.value = workspaces.value[0]?.id ?? null;
        }
      })
      .catch(() => {
        workspaces.value = [];
        selectedWorkspaceId.value = null;
        hasLoadError.value = true;
      })
      .finally(() => {
        isLoading.value = false;
        pendingWorkspacesRequest = null;
      });

    return pendingWorkspacesRequest;
  };

  const createWorkspace = async (name: string) => {
    const response = await createWorkspaceApi({ name });
    await loadWorkspaces();
    selectedWorkspaceId.value = response.data?.id ?? selectedWorkspaceId.value;
    return response.data;
  };

  const resetWorkspaces = () => {
    workspaces.value = [];
    selectedWorkspaceId.value = null;
    isLoading.value = false;
    hasLoadError.value = false;
    pendingWorkspacesRequest = null;
  };

  return {
    workspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    isLoading,
    hasLoadError,
    selectWorkspace,
    loadWorkspaces,
    createWorkspace,
    resetWorkspaces,
  };
});
