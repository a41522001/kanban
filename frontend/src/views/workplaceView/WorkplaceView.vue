<template>
  <main class="workplace">
    <header class="workplace__header">
      <div class="workplace__header-content">
        <RouterLink class="workplace__brand" :to="{ name: 'workspace' }">
          <Logo />
        </RouterLink>

        <nav class="workplace__navigation" :aria-label="t('workplace.navigation.label')">
          <RouterLink
            :to="{ name: 'workspace' }"
            class="workplace__navigation-link workplace__navigation-link--active"
          >
            {{ t('workplace.navigation.workspaces') }}
          </RouterLink>
          <span class="workplace__navigation-link workplace__navigation-link--muted">
            {{ t('workplace.navigation.recent') }}
          </span>
        </nav>

        <div class="workplace__header-actions">
          <Button
            class="workplace__create-icon-button"
            size="icon"
            :aria-label="t('workplace.actions.createWorkspace')"
            @click="openCreateDialog"
          >
            <Plus :size="20" aria-hidden="true" />
          </Button>
          <UserMenu v-if="userStore.user" :user="userStore.user" />
        </div>
      </div>
    </header>

    <div class="workplace__layout">
      <aside class="workplace__sidebar" :aria-label="t('workplace.sidebar.label')">
        <p class="workplace__sidebar-label">{{ t('workplace.sidebar.yourWorkspaces') }}</p>

        <div v-if="isLoading" class="workplace__workspace-list" aria-busy="true">
          <Skeleton v-for="index in 2" :key="index" class="h-14 w-full" />
        </div>
        <div v-else class="workplace__workspace-list">
          <button
            v-for="workspace in workspaces"
            :key="workspace.id"
            type="button"
            class="workplace__workspace-option"
            :class="{
              'workplace__workspace-option--selected': workspace.id === selectedWorkspaceId,
            }"
            :aria-current="workspace.id === selectedWorkspaceId ? 'page' : undefined"
            @click="selectWorkspace(workspace.id)"
          >
            <span class="workplace__workspace-monogram" aria-hidden="true">
              {{ workspace.name.trim().charAt(0).toUpperCase() }}
            </span>
            <span class="workplace__workspace-details">
              <span class="workplace__workspace-name">{{ workspace.name }}</span>
              <span class="workplace__workspace-meta">
                {{ getRoleLabel(workspace.currentUserRole) }}
              </span>
            </span>
          </button>
        </div>

        <Button variant="outline" class="workplace__new-workspace-button" @click="openCreateDialog">
          <Plus :size="18" aria-hidden="true" />
          {{ t('workplace.actions.createWorkspace') }}
        </Button>

        <section v-if="selectedWorkspace" class="workplace__sidebar-management">
          <p class="workplace__sidebar-label">{{ t('workplace.sidebar.management') }}</p>
          <div class="workplace__management-row">
            <UsersRound :size="17" aria-hidden="true" />
            <span>{{ t('workplace.sidebar.members') }}</span>
            <span class="workplace__management-count">{{ members.length }}</span>
          </div>
          <div class="workplace__management-row workplace__management-row--muted">
            <Archive :size="17" aria-hidden="true" />
            <span>{{ t('workplace.sidebar.archivedProjects') }}</span>
          </div>
        </section>

        <section v-if="selectedWorkspace" class="workplace__members">
          <p class="workplace__sidebar-label">{{ t('workplace.sidebar.workspaceMembers') }}</p>
          <div v-if="isMembersLoading" class="workplace__member-skeletons" aria-busy="true">
            <Skeleton v-for="index in 3" :key="index" class="size-8 rounded-full" />
          </div>
          <template v-else>
            <ul
              class="workplace__member-list"
              :aria-label="t('workplace.sidebar.workspaceMembers')"
            >
              <li v-for="member in visibleMembers" :key="member.memberId">
                <span class="workplace__member-avatar" :title="member.displayName">
                  {{ member.displayName.trim().charAt(0).toUpperCase() }}
                </span>
              </li>
              <li v-if="remainingMemberCount > 0">
                <span class="workplace__member-avatar workplace__member-avatar--more">
                  +{{ remainingMemberCount }}
                </span>
              </li>
            </ul>
            <p class="workplace__member-summary">
              {{ t('workplace.sidebar.memberSummary', { count: members.length }) }}
            </p>
          </template>
        </section>
      </aside>

      <section class="workplace__content">
        <label class="workplace__mobile-switcher-label" for="workspace-switcher">
          {{ t('workplace.mobile.currentWorkspace') }}
        </label>
        <select
          id="workspace-switcher"
          v-model="selectedWorkspaceId"
          class="workplace__mobile-switcher"
          :aria-label="t('workplace.mobile.selectWorkspace')"
        >
          <option v-for="workspace in workspaces" :key="workspace.id" :value="workspace.id">
            {{ workspace.name }}
          </option>
        </select>

        <div v-if="isLoading" class="workplace__content-skeleton" aria-busy="true">
          <Skeleton class="h-3 w-16" />
          <Skeleton class="mt-4 h-10 w-64" />
          <Skeleton class="mt-3 h-5 w-96 max-w-full" />
          <div class="workplace__project-skeleton-grid">
            <Skeleton v-for="index in 3" :key="index" class="h-52 w-full" />
          </div>
        </div>

        <div v-else-if="hasLoadError" class="workplace__state" role="alert">
          <CircleAlert :size="28" aria-hidden="true" />
          <h1 class="workplace__state-title">{{ t('workplace.states.loadErrorTitle') }}</h1>
          <p>{{ t('workplace.states.loadErrorDescription') }}</p>
          <Button variant="outline" @click="void loadWorkspaces()">
            {{ t('workplace.actions.retry') }}
          </Button>
        </div>

        <div v-else-if="!selectedWorkspace" class="workplace__state">
          <Layers3 :size="32" aria-hidden="true" />
          <h1 class="workplace__state-title">{{ t('workplace.states.noWorkspaceTitle') }}</h1>
          <p>{{ t('workplace.states.noWorkspaceDescription') }}</p>
          <Button @click="openCreateDialog">
            <Plus :size="18" aria-hidden="true" />
            {{ t('workplace.actions.createWorkspace') }}
          </Button>
        </div>

        <template v-else>
          <div class="workplace__content-heading">
            <div>
              <p class="workplace__eyebrow">{{ t('workplace.eyebrow') }}</p>
              <h1 class="workplace__title">{{ selectedWorkspace.name }}</h1>
              <p class="workplace__description">{{ t('workplace.description') }}</p>
            </div>
            <div class="workplace__project-action">
              <Button disabled :aria-describedby="'project-api-note'">
                <Plus :size="18" aria-hidden="true" />
                {{ t('workplace.actions.createProject') }}
              </Button>
              <p id="project-api-note" class="sr-only">
                {{ t('workplace.states.projectApiPending') }}
              </p>
            </div>
          </div>

          <section class="workplace__projects" :aria-labelledby="'all-projects-title'">
            <div class="workplace__section-heading">
              <div>
                <h2 id="all-projects-title">{{ t('workplace.projects.title') }}</h2>
                <p>{{ t('workplace.projects.sortHint') }}</p>
              </div>
            </div>

            <div class="workplace__projects-empty">
              <PanelTop :size="28" aria-hidden="true" />
              <h3>{{ t('workplace.states.noProjectsTitle') }}</h3>
              <p>{{ t('workplace.states.projectApiPending') }}</p>
            </div>
          </section>
        </template>
      </section>
    </div>

    <Dialog v-model:open="isCreateDialogOpen" @update:open="handleCreateDialogChange">
      <DialogContent class="workplace__dialog" :show-close-button="false">
        <DialogHeader>
          <DialogTitle>{{ t('workplace.dialog.title') }}</DialogTitle>
          <DialogDescription>{{ t('workplace.dialog.description') }}</DialogDescription>
        </DialogHeader>

        <form class="workplace__dialog-form" @submit.prevent="handleCreateWorkspace">
          <FormField
            input-id="workspace-name"
            :label="t('workplace.dialog.nameLabel')"
            required
            :error="workspaceNameError"
          >
            <template #default="{ invalid, describedBy }">
              <Input
                id="workspace-name"
                v-model="workspaceName"
                :placeholder="t('workplace.dialog.namePlaceholder')"
                :maxlength="workspaceNameMaxLength"
                autocomplete="organization"
                :invalid="invalid"
                :aria-describedby="describedBy"
                @blur="hasTriedCreate = true"
              />
            </template>
          </FormField>

          <DialogFooter class="workplace__dialog-footer">
            <DialogClose as-child>
              <Button type="button" variant="outline">{{ t('workplace.actions.cancel') }}</Button>
            </DialogClose>
            <Button type="submit" :loading="isCreating">
              {{ t('workplace.actions.create') }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { Archive, CircleAlert, Layers3, PanelTop, Plus, UsersRound } from 'lucide-vue-next';
import type { WorkspaceMemberDto, WorkspaceRole } from '@kanban/contracts/workspaces';
import FormField from '@/components/common/FormField.vue';
import Input from '@/components/common/Input.vue';
import Logo from '@/components/common/Logo.vue';
import UserMenu from '@/components/common/UserMenu.vue';
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
import { useUserStore } from '@/stores/user';
import { useWorkspaceStore } from '@/stores/workspace';
import { validateWorkspaceName, workspaceNameMaxLength } from './workplace';

const { t } = useI18n();
const userStore = useUserStore();
const workspaceStore = useWorkspaceStore();
const { hasLoadError, isLoading, selectedWorkspace, selectedWorkspaceId, workspaces } =
  storeToRefs(workspaceStore);
const { createWorkspace, loadWorkspaces, selectWorkspace } = workspaceStore;

const isCreateDialogOpen = ref(false);
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
    return t('workplace.validation.nameRequired');
  }

  if (validation === 'maxLength') {
    return t('workplace.validation.nameMaxLength', { count: workspaceNameMaxLength });
  }

  return undefined;
});

const visibleMembers = computed(() => members.value.slice(0, 3));
const remainingMemberCount = computed(() =>
  Math.max(members.value.length - visibleMembers.value.length, 0),
);

const getRoleLabel = (role: WorkspaceRole) => {
  return role === 'OWNER' ? t('workplace.roles.owner') : t('workplace.roles.member');
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

watch(selectedWorkspaceId, (workspaceId) => {
  void loadMembers(workspaceId);
});

onMounted(() => {
  void loadWorkspaces();
});
</script>

<style scoped src="./workplace-view.css"></style>
