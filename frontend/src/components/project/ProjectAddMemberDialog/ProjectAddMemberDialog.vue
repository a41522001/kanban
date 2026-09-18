<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent
      class="project-add-member-dialog"
      :show-close-button="false"
      @escape-key-down="handleDismissAttempt"
      @pointer-down-outside="handleDismissAttempt"
    >
      <DialogHeader class="project-add-member-dialog__header">
        <div class="project-add-member-dialog__heading-copy">
          <DialogTitle class="project-add-member-dialog__title">
            {{ t('workspace.projectMembers.addTitle') }}
          </DialogTitle>
          <DialogDescription class="project-add-member-dialog__description">
            {{ t('workspace.projectMembers.addDescription', { workspace: workspaceName }) }}
          </DialogDescription>
        </div>
        <button
          type="button"
          class="project-add-member-dialog__close"
          :aria-label="t('workspace.projectMembers.close')"
          :disabled="isSubmitting"
          @click="closeDialog"
        >
          <X :size="20" aria-hidden="true" />
        </button>
      </DialogHeader>

      <section class="project-add-member-dialog__context">
        <span class="project-add-member-dialog__project-mark" aria-hidden="true">
          {{ project.name.trim().charAt(0).toUpperCase() || '?' }}
        </span>
        <span class="project-add-member-dialog__context-copy">
          <strong>{{ project.name }}</strong>
          <span>
            {{ t('workspace.projectMembers.currentCount', { count: memberCount }) }}
          </span>
        </span>
      </section>

      <div class="project-add-member-dialog__search-section">
        <label for="project-member-search">{{ t('workspace.projectMembers.workspaceMembers') }}</label>
        <div class="project-add-member-dialog__search">
          <Search :size="18" aria-hidden="true" />
          <input
            id="project-member-search"
            v-model="searchQuery"
            type="search"
            :placeholder="t('workspace.projectMembers.searchPlaceholder')"
            :disabled="isLoading || isSubmitting"
          />
        </div>
      </div>

      <div class="project-add-member-dialog__body" aria-live="polite">
        <template v-if="isLoading">
          <p class="project-add-member-dialog__section-label">
            {{ t('workspace.projectMembers.availableMembers') }}
          </p>
          <div class="project-add-member-dialog__candidate-list" aria-busy="true">
            <div v-for="index in 4" :key="index" class="project-add-member-dialog__skeleton-row">
              <Skeleton class="size-9 rounded-full" />
              <span>
                <Skeleton class="h-3 w-28" />
                <Skeleton class="mt-2 h-2 w-20" />
              </span>
            </div>
          </div>
          <p class="project-add-member-dialog__status">
            {{ t('workspace.projectMembers.loading') }}
          </p>
        </template>

        <div v-else-if="loadError" class="project-add-member-dialog__state" role="alert">
          <CircleAlert :size="28" aria-hidden="true" />
          <strong>{{ t('workspace.projectMembers.loadErrorTitle') }}</strong>
          <p>{{ t('workspace.projectMembers.loadErrorDescription') }}</p>
          <Button type="button" variant="outline" size="sm" @click="void loadCandidates()">
            {{ t('workspace.actions.retry') }}
          </Button>
        </div>

        <div v-else-if="!filteredCandidates.length" class="project-add-member-dialog__state">
          <SearchX :size="28" aria-hidden="true" />
          <strong>{{ t('workspace.projectMembers.emptyTitle') }}</strong>
          <p>{{ t('workspace.projectMembers.emptyDescription') }}</p>
        </div>

        <template v-else>
          <p class="project-add-member-dialog__section-label">
            {{ t('workspace.projectMembers.availableMembers') }}
          </p>
          <ul class="project-add-member-dialog__candidate-list">
            <li v-for="candidate in filteredCandidates" :key="candidate.workspaceMemberId">
              <button
                type="button"
                class="project-add-member-dialog__candidate"
                :class="{
                  'project-add-member-dialog__candidate--selected':
                    selectedWorkspaceMemberId === candidate.workspaceMemberId,
                  'project-add-member-dialog__candidate--joined': candidate.projectRole,
                }"
                :disabled="Boolean(candidate.projectRole) || isSubmitting"
                :aria-pressed="
                  candidate.projectRole
                    ? undefined
                    : selectedWorkspaceMemberId === candidate.workspaceMemberId
                "
                @click="selectedWorkspaceMemberId = candidate.workspaceMemberId"
              >
                <img
                  v-if="candidate.avatarUrl"
                  :src="candidate.avatarUrl"
                  :alt="candidate.displayName"
                />
                <span v-else class="project-add-member-dialog__avatar" aria-hidden="true">
                  {{ candidate.displayName.trim().charAt(0).toUpperCase() }}
                </span>
                <span class="project-add-member-dialog__candidate-copy">
                  <strong>{{ candidate.displayName }}</strong>
                  <small v-if="candidate.projectRole">
                    {{
                      t('workspace.projectMembers.joinedWithRole', {
                        role: getRoleLabel(candidate.projectRole),
                      })
                    }}
                  </small>
                  <small v-else>{{ t('workspace.projectMembers.workspaceMember') }}</small>
                </span>
                <span
                  v-if="candidate.projectRole"
                  class="project-add-member-dialog__joined-badge"
                >
                  {{ t('workspace.projectMembers.joined') }}
                </span>
                <span v-else class="project-add-member-dialog__selection" aria-hidden="true">
                  <Check
                    v-if="selectedWorkspaceMemberId === candidate.workspaceMemberId"
                    :size="14"
                  />
                </span>
              </button>
            </li>
          </ul>

          <fieldset class="project-add-member-dialog__roles" :disabled="isSubmitting">
            <legend>{{ t('workspace.projectMembers.projectRole') }}</legend>
            <label
              v-for="roleOption in roleOptions"
              :key="roleOption"
              class="project-add-member-dialog__role"
              :class="{ 'project-add-member-dialog__role--selected': role === roleOption }"
            >
              <span>
                <strong>{{ roleOption }}</strong>
                <small>{{ t(`workspace.projectMembers.roles.${roleOption}.description`) }}</small>
              </span>
              <input v-model="role" type="radio" name="project-role" :value="roleOption" />
            </label>
          </fieldset>
        </template>
      </div>

      <p v-if="submitError" class="project-add-member-dialog__submit-error" role="alert">
        <CircleAlert :size="18" aria-hidden="true" />
        <span>{{ submitError }}</span>
      </p>

      <DialogFooter class="project-add-member-dialog__footer">
        <Button type="button" variant="outline" :disabled="isSubmitting" @click="closeDialog">
          {{ t('workspace.actions.cancel') }}
        </Button>
        <Button
          type="button"
          :loading="isSubmitting"
          :disabled="!canSubmit"
          @click="void handleSubmit()"
        >
          {{
            isSubmitting
              ? t('workspace.projectMembers.adding')
              : t('workspace.projectMembers.addAction')
          }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Check, CircleAlert, Search, SearchX, X } from 'lucide-vue-next';
import type {
  AssignableProjectRole,
  MemberCandidate,
  ProjectListItemDto,
  ProjectRole,
} from '@kanban/contracts/project';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { addProjectMemberApi, getProjectMemberCandidatesApi } from '@/services/project';
import { getApiErrorResponse } from '@/services/http';

const props = defineProps<{
  project: ProjectListItemDto;
  workspaceName: string;
  memberCount: number;
}>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ added: [workspaceMemberId: string] }>();
const { t } = useI18n();

const roleOptions: AssignableProjectRole[] = ['EDITOR', 'VIEWER'];
const candidates = ref<MemberCandidate[]>([]);
const searchQuery = ref('');
const selectedWorkspaceMemberId = ref<string | null>(null);
const role = ref<AssignableProjectRole>('EDITOR');
const isLoading = ref(false);
const loadError = ref(false);
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);
let requestId = 0;

const filteredCandidates = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  if (!query) return candidates.value;
  return candidates.value.filter((candidate) =>
    candidate.displayName.toLocaleLowerCase().includes(query),
  );
});
const canSubmit = computed(
  () =>
    Boolean(selectedWorkspaceMemberId.value) &&
    !isLoading.value &&
    !loadError.value &&
    !isSubmitting.value,
);

const getRoleLabel = (projectRole: ProjectRole) =>
  t(`workspace.projectMembers.roles.${projectRole}.label`);

const reset = () => {
  searchQuery.value = '';
  selectedWorkspaceMemberId.value = null;
  role.value = 'EDITOR';
  submitError.value = null;
  loadError.value = false;
};

const loadCandidates = async () => {
  const currentRequestId = ++requestId;
  isLoading.value = true;
  loadError.value = false;
  submitError.value = null;
  try {
    const response = await getProjectMemberCandidatesApi(props.project.id);
    if (currentRequestId !== requestId) return;
    candidates.value = response.data ?? [];
    if (
      selectedWorkspaceMemberId.value &&
      !candidates.value.some(
        (candidate) =>
          candidate.workspaceMemberId === selectedWorkspaceMemberId.value &&
          candidate.projectRole === null,
      )
    ) {
      selectedWorkspaceMemberId.value = null;
    }
  } catch {
    if (currentRequestId === requestId) loadError.value = true;
  } finally {
    if (currentRequestId === requestId) isLoading.value = false;
  }
};

const closeDialog = () => {
  if (isSubmitting.value) return;
  open.value = false;
  reset();
};
const handleOpenChange = (value: boolean) => {
  if (!value) closeDialog();
  else open.value = true;
};
const handleDismissAttempt = (event: Event) => {
  if (isSubmitting.value) event.preventDefault();
};

const handleSubmit = async () => {
  if (!canSubmit.value || !selectedWorkspaceMemberId.value) return;
  isSubmitting.value = true;
  submitError.value = null;
  try {
    const workspaceMemberId = selectedWorkspaceMemberId.value;
    await addProjectMemberApi({ projectId: props.project.id, workspaceMemberId, role: role.value });
    toast.success(t('workspace.projectMembers.addSuccess'));
    emit('added', workspaceMemberId);
    open.value = false;
    reset();
  } catch (error: unknown) {
    submitError.value =
      getApiErrorResponse(error)?.message ?? t('workspace.projectMembers.addError');
  } finally {
    isSubmitting.value = false;
  }
};

watch(
  () => [open.value, props.project.id] as const,
  ([isOpen]) => {
    if (isOpen) {
      reset();
      void loadCandidates();
    } else {
      requestId += 1;
    }
  },
  { immediate: true },
);
</script>

<style scoped src="./ProjectAddMemberDialog.css"></style>
