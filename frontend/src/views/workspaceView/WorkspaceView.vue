<template>
  <main class="workspace">
    <header class="workspace__header">
      <div class="workspace__header-content">
        <RouterLink class="workspace__brand" :to="{ name: 'workspace' }">
          <Logo />
        </RouterLink>

        <nav class="workspace__navigation" :aria-label="t('workspace.navigation.label')">
          <RouterLink
            :to="{ name: 'workspace' }"
            class="workspace__navigation-link workspace__navigation-link--active"
          >
            {{ t('workspace.navigation.workspaces') }}
          </RouterLink>
          <span class="workspace__navigation-link workspace__navigation-link--muted">
            {{ t('workspace.navigation.recent') }}
          </span>
        </nav>

        <div class="workspace__header-actions">
          <Button
            class="workspace__create-icon-button"
            size="icon"
            :aria-label="t('workspace.actions.createWorkspace')"
            @click="openCreateDialog"
          >
            <Plus :size="20" aria-hidden="true" />
          </Button>
          <NotificationMenu />
          <UserMenu v-if="userStore.user" :user="userStore.user" />
        </div>
      </div>
    </header>

    <div class="workspace__layout">
      <aside class="workspace__sidebar" :aria-label="t('workspace.sidebar.label')">
        <p class="workspace__sidebar-label">{{ t('workspace.sidebar.yourWorkspaces') }}</p>

        <div v-if="isLoading" class="workspace__workspace-list" aria-busy="true">
          <Skeleton v-for="index in 2" :key="index" class="h-14 w-full" />
        </div>
        <div v-else class="workspace__workspace-list">
          <button
            v-for="workspace in workspaces"
            :key="workspace.id"
            type="button"
            class="workspace__workspace-option"
            :class="{
              'workspace__workspace-option--selected': workspace.id === selectedWorkspaceId,
            }"
            :aria-current="workspace.id === selectedWorkspaceId ? 'page' : undefined"
            @click="selectWorkspace(workspace.id)"
          >
            <span class="workspace__workspace-monogram" aria-hidden="true">
              {{ workspace.name.trim().charAt(0).toUpperCase() }}
            </span>
            <span class="workspace__workspace-details">
              <span class="workspace__workspace-name">{{ workspace.name }}</span>
              <span class="workspace__workspace-meta">
                {{ getRoleLabel(workspace.currentUserRole) }}
              </span>
            </span>
          </button>
        </div>

        <Button variant="outline" class="workspace__new-workspace-button" @click="openCreateDialog">
          <Plus :size="18" aria-hidden="true" />
          {{ t('workspace.actions.createWorkspace') }}
        </Button>

        <section v-if="selectedWorkspace" class="workspace__sidebar-management">
          <p class="workspace__sidebar-label">{{ t('workspace.sidebar.management') }}</p>
          <div class="workspace__management-row">
            <UsersRound :size="17" aria-hidden="true" />
            <span>{{ t('workspace.sidebar.members') }}</span>
            <span class="workspace__management-count">{{ members.length }}</span>
          </div>
          <div class="workspace__management-row workspace__management-row--muted">
            <Archive :size="17" aria-hidden="true" />
            <span>{{ t('workspace.sidebar.archivedProjects') }}</span>
          </div>
        </section>

        <section v-if="selectedWorkspace" class="workspace__members">
          <p class="workspace__sidebar-label">{{ t('workspace.sidebar.workspaceMembers') }}</p>
          <div v-if="isMembersLoading" class="workspace__member-skeletons" aria-busy="true">
            <Skeleton v-for="index in 3" :key="index" class="size-8 rounded-full" />
          </div>
          <template v-else>
            <ul
              class="workspace__member-list"
              :aria-label="t('workspace.sidebar.workspaceMembers')"
            >
              <li v-for="member in visibleMembers" :key="member.memberId">
                <span class="workspace__member-avatar" :title="member.displayName">
                  {{ member.displayName.trim().charAt(0).toUpperCase() }}
                </span>
              </li>
              <li v-if="remainingMemberCount > 0">
                <span class="workspace__member-avatar workspace__member-avatar--more">
                  +{{ remainingMemberCount }}
                </span>
              </li>
            </ul>
            <p class="workspace__member-summary">
              {{ t('workspace.sidebar.memberSummary', { count: members.length }) }}
            </p>
          </template>
        </section>
      </aside>

      <section class="workspace__content">
        <label class="workspace__mobile-switcher-label" for="workspace-switcher">
          {{ t('workspace.mobile.currentWorkspace') }}
        </label>
        <select
          id="workspace-switcher"
          v-model="selectedWorkspaceId"
          class="workspace__mobile-switcher"
          :aria-label="t('workspace.mobile.selectWorkspace')"
        >
          <option v-for="workspace in workspaces" :key="workspace.id" :value="workspace.id">
            {{ workspace.name }}
          </option>
        </select>

        <div v-if="isLoading" class="workspace__content-skeleton" aria-busy="true">
          <Skeleton class="h-3 w-16" />
          <Skeleton class="mt-4 h-10 w-64" />
          <Skeleton class="mt-3 h-5 w-96 max-w-full" />
          <div class="workspace__project-skeleton-grid">
            <Skeleton v-for="index in 3" :key="index" class="h-52 w-full" />
          </div>
        </div>

        <div v-else-if="hasLoadError" class="workspace__state" role="alert">
          <CircleAlert :size="28" aria-hidden="true" />
          <h1 class="workspace__state-title">{{ t('workspace.states.loadErrorTitle') }}</h1>
          <p>{{ t('workspace.states.loadErrorDescription') }}</p>
          <Button variant="outline" @click="void loadWorkspaces()">
            {{ t('workspace.actions.retry') }}
          </Button>
        </div>

        <div v-else-if="!selectedWorkspace" class="workspace__state">
          <Layers3 :size="32" aria-hidden="true" />
          <h1 class="workspace__state-title">{{ t('workspace.states.noWorkspaceTitle') }}</h1>
          <p>{{ t('workspace.states.noWorkspaceDescription') }}</p>
          <Button @click="openCreateDialog">
            <Plus :size="18" aria-hidden="true" />
            {{ t('workspace.actions.createWorkspace') }}
          </Button>
        </div>

        <template v-else>
          <div class="workspace__content-heading">
            <div>
              <p class="workspace__eyebrow">{{ t('workspace.eyebrow') }}</p>
              <h1 class="workspace__title">{{ selectedWorkspace.name }}</h1>
              <p class="workspace__description">{{ t('workspace.description') }}</p>
            </div>
            <div class="workspace__project-action">
              <Button v-if="canInviteMembers" variant="outline" @click="isInviteDialogOpen = true">
                <UserPlus :size="18" aria-hidden="true" />
                {{ t('workspace.actions.inviteMember') }}
              </Button>
              <Button disabled :aria-describedby="'project-api-note'">
                <Plus :size="18" aria-hidden="true" />
                {{ t('workspace.actions.createProject') }}
              </Button>
              <p id="project-api-note" class="sr-only">
                {{ t('workspace.states.projectApiPending') }}
              </p>
            </div>
          </div>

          <section class="workspace__projects" :aria-labelledby="'all-projects-title'">
            <div class="workspace__section-heading">
              <div>
                <h2 id="all-projects-title">{{ t('workspace.projects.title') }}</h2>
                <p>{{ t('workspace.projects.sortHint') }}</p>
              </div>
            </div>

            <div class="workspace__projects-empty">
              <PanelTop :size="28" aria-hidden="true" />
              <h3>{{ t('workspace.states.noProjectsTitle') }}</h3>
              <p>{{ t('workspace.states.projectApiPending') }}</p>
            </div>
          </section>
        </template>
      </section>
    </div>

    <Dialog v-model:open="isCreateDialogOpen" @update:open="handleCreateDialogChange">
      <DialogContent class="workspace__dialog" :show-close-button="false">
        <DialogHeader>
          <DialogTitle>{{ t('workspace.dialog.title') }}</DialogTitle>
          <DialogDescription>{{ t('workspace.dialog.description') }}</DialogDescription>
        </DialogHeader>

        <form class="workspace__dialog-form" @submit.prevent="handleCreateWorkspace">
          <FormField
            input-id="workspace-name"
            :label="t('workspace.dialog.nameLabel')"
            required
            :error="workspaceNameError"
          >
            <template #default="{ invalid, describedBy }">
              <Input
                id="workspace-name"
                v-model="workspaceName"
                :placeholder="t('workspace.dialog.namePlaceholder')"
                :maxlength="workspaceNameMaxLength"
                autocomplete="organization"
                :invalid="invalid"
                :aria-describedby="describedBy"
                @blur="hasTriedCreate = true"
              />
            </template>
          </FormField>

          <DialogFooter class="workspace__dialog-footer">
            <DialogClose as-child>
              <Button type="button" variant="outline">{{ t('workspace.actions.cancel') }}</Button>
            </DialogClose>
            <Button type="submit" :loading="isCreating">
              {{ t('workspace.actions.create') }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <WorkspaceInviteDialog
      v-if="selectedWorkspace"
      v-model:open="isInviteDialogOpen"
      :workspace="selectedWorkspace"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import {
  Archive,
  CircleAlert,
  Layers3,
  PanelTop,
  Plus,
  UserPlus,
  UsersRound,
} from 'lucide-vue-next';
import type { WorkspaceMemberDto, WorkspaceRole } from '@kanban/contracts/workspaces';
import FormField from '@/components/shared/FormField/FormField.vue';
import Input from '@/components/shared/Input/Input.vue';
import Logo from '@/components/shared/Logo/Logo.vue';
import NotificationMenu from '@/components/notifications/NotificationMenu/NotificationMenu.vue';
import UserMenu from '@/components/account/UserMenu/UserMenu.vue';
import WorkspaceInviteDialog from '@/components/workspace/WorkspaceInviteDialog/WorkspaceInviteDialog.vue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getWorkspaceMembersApi } from '@/services/workspace';
import { getApiErrorResponse } from '@/services/http';
import { useUserStore } from '@/stores/user';
import { useWorkspaceStore } from '@/stores/workspace';
import { validateWorkspaceName, workspaceNameMaxLength } from './workspace';
import type { WorkspaceMemberChangedPayload } from '@kanban/contracts/socket';

import {
  emitWorkspaceInto,
  emitWorkspaceLeave,
  onWorkspaceMemberChanged,
  offWorkspaceMemberChanged,
} from '@/services/socket';

const { t } = useI18n();
const userStore = useUserStore();
const workspaceStore = useWorkspaceStore();
const { hasLoadError, isLoading, selectedWorkspace, selectedWorkspaceId, workspaces } =
  storeToRefs(workspaceStore);
const { createWorkspace, loadWorkspaces, selectWorkspace } = workspaceStore;

const isCreateDialogOpen = ref(false);
const isInviteDialogOpen = ref(false);
const isCreating = ref(false);
const hasTriedCreate = ref(false);
const workspaceName = ref('');
const members = ref<WorkspaceMemberDto[]>([]);
const isMembersLoading = ref(false);
let memberRequestId = 0;

const workspaceNameError = computed(() => {
  if (!hasTriedCreate.value) {
    return undefined;
  }

  const validation = validateWorkspaceName(workspaceName.value);

  if (validation === 'required') {
    return t('workspace.validation.nameRequired');
  }

  if (validation === 'maxLength') {
    return t('workspace.validation.nameMaxLength', { count: workspaceNameMaxLength });
  }

  return undefined;
});

const canInviteMembers = computed(() => selectedWorkspace.value?.currentUserRole === 'OWNER');

const visibleMembers = computed(() => members.value.slice(0, 3));
const remainingMemberCount = computed(() =>
  Math.max(members.value.length - visibleMembers.value.length, 0),
);

const getRoleLabel = (role: WorkspaceRole) => {
  return role === 'OWNER' ? t('workspace.roles.owner') : t('workspace.roles.member');
};

const openCreateDialog = () => {
  isCreateDialogOpen.value = true;
};

const resetCreateForm = () => {
  workspaceName.value = '';
  hasTriedCreate.value = false;
};

const handleCreateDialogChange = (isOpen: boolean) => {
  isCreateDialogOpen.value = isOpen;

  if (!isOpen && !isCreating.value) {
    resetCreateForm();
  }
};

const handleCreateWorkspace = async () => {
  hasTriedCreate.value = true;

  if (workspaceNameError.value) {
    return;
  }

  isCreating.value = true;

  try {
    await createWorkspace(workspaceName.value.trim());
    isCreateDialogOpen.value = false;
    resetCreateForm();
  } catch (error: unknown) {
    toast.error(getApiErrorResponse(error)?.message ?? t('error.requestFailed'));
  } finally {
    isCreating.value = false;
  }
};

const loadMembers = async (workspaceId: string | null) => {
  const requestId = ++memberRequestId;
  members.value = [];

  if (!workspaceId) {
    return;
  }

  isMembersLoading.value = true;

  try {
    const response = await getWorkspaceMembersApi(workspaceId);

    if (requestId === memberRequestId) {
      members.value = response.data ?? [];
    }
  } catch {
    // 成員清單失敗不阻斷工作區本身的使用；之後可加上成員管理頁的錯誤狀態。
  } finally {
    if (requestId === memberRequestId) {
      isMembersLoading.value = false;
    }
  }
};

// #region socket
const handleWorkspaceMemberChanged = ({ workspaceId }: WorkspaceMemberChangedPayload) => {
  if (workspaceId !== selectedWorkspaceId.value) {
    return;
  }
  loadMembers(workspaceId);
};

watch(
  selectedWorkspaceId,
  (newWorkspaceId, previousWorkspaceId) => {
    if (previousWorkspaceId) {
      emitWorkspaceLeave(previousWorkspaceId);
    }
    if (newWorkspaceId) {
      emitWorkspaceInto(newWorkspaceId);
    }
    isInviteDialogOpen.value = false;
    void loadMembers(newWorkspaceId);
  },
  {
    immediate: true,
  },
);

onMounted(() => {
  onWorkspaceMemberChanged(handleWorkspaceMemberChanged);
  void loadWorkspaces();
});
onUnmounted(() => {
  offWorkspaceMemberChanged(handleWorkspaceMemberChanged);
  if (selectedWorkspaceId.value) {
    emitWorkspaceLeave(selectedWorkspaceId.value);
  }
});
// #endregion
</script>

<style scoped src="./workspace-view.css"></style>
