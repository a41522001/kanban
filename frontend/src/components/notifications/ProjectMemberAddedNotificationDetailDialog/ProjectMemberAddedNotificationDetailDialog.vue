<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent class="project-member-added-detail-dialog" :show-close-button="false">
      <header class="project-member-added-detail-dialog__header">
        <div class="project-member-added-detail-dialog__identity">
          <span class="project-member-added-detail-dialog__status-icon" aria-hidden="true">
            <UsersRound :size="20" :stroke-width="1.8" />
            <span class="project-member-added-detail-dialog__status-badge">
              <Check :size="11" :stroke-width="2.5" />
            </span>
          </span>

          <div class="project-member-added-detail-dialog__heading">
            <DialogTitle>{{ t('notification.projectMemberAdded.detail.title') }}</DialogTitle>
            <DialogDescription>
              {{ headingDescription }}
            </DialogDescription>
          </div>
        </div>

        <button
          type="button"
          class="project-member-added-detail-dialog__close"
          :aria-label="t('notification.projectMemberAdded.detail.close')"
          @click="closeDialog"
        >
          <X :size="20" :stroke-width="2" aria-hidden="true" />
        </button>
      </header>

      <div
        v-if="viewState === 'loading'"
        class="project-member-added-detail-dialog__loading"
        aria-busy="true"
        :aria-label="t('notification.projectMemberAdded.detail.loading')"
      >
        <section class="project-member-added-detail-dialog__summary">
          <div class="project-member-added-detail-dialog__summary-top">
            <Skeleton class="project-member-added-detail-dialog__skeleton-mark" />
            <div class="project-member-added-detail-dialog__skeleton-copy">
              <Skeleton class="project-member-added-detail-dialog__skeleton-line" />
              <Skeleton class="project-member-added-detail-dialog__skeleton-title" />
              <Skeleton class="project-member-added-detail-dialog__skeleton-short" />
            </div>
          </div>
          <Skeleton class="project-member-added-detail-dialog__skeleton-badges" />
        </section>

        <div class="project-member-added-detail-dialog__details-skeleton">
          <Skeleton v-for="index in 4" :key="index" class="h-4 w-full" />
        </div>
      </div>

      <section
        v-else-if="viewState === 'error'"
        class="project-member-added-detail-dialog__error"
        role="alert"
      >
        <span class="project-member-added-detail-dialog__error-icon" aria-hidden="true">
          <CircleAlert :size="24" :stroke-width="2" />
        </span>
        <h3>{{ t('notification.projectMemberAdded.detail.errorTitle') }}</h3>
        <p>{{ t('notification.projectMemberAdded.detail.errorDescription') }}</p>
        <Button size="sm" @click="loadDetail">
          {{ t('notification.projectMemberAdded.detail.retry') }}
        </Button>
      </section>

      <template v-else-if="detail">
        <section class="project-member-added-detail-dialog__summary">
          <div class="project-member-added-detail-dialog__summary-top">
            <div class="project-member-added-detail-dialog__project-visual" aria-hidden="true">
              <span class="project-member-added-detail-dialog__project-mark">
                {{ projectInitial }}
              </span>
              <span class="project-member-added-detail-dialog__inviter-avatar">
                {{ inviterInitial }}
              </span>
            </div>

            <div class="project-member-added-detail-dialog__project-copy">
              <p>
                {{
                  t('notification.projectMemberAdded.detail.addedBy', {
                    inviter: detail.inviterName ?? t('notification.fallbackActor'),
                  })
                }}
              </p>
              <h3>{{ detail.projectName }}</h3>
              <span>{{ detail.workspaceName }}</span>
            </div>
          </div>

          <div class="project-member-added-detail-dialog__summary-divider" aria-hidden="true"></div>

          <div class="project-member-added-detail-dialog__badges">
            <span class="project-member-added-detail-dialog__joined-badge">
              <Check :size="12" :stroke-width="2.5" aria-hidden="true" />
              {{ t('notification.projectMemberAdded.detail.joined') }}
            </span>
            <span class="project-member-added-detail-dialog__role-badge">
              {{ detail.role }}
            </span>
          </div>
        </section>

        <section class="project-member-added-detail-dialog__member-info">
          <h3>{{ t('notification.projectMemberAdded.detail.memberInfo') }}</h3>
          <dl>
            <div class="project-member-added-detail-dialog__detail-row">
              <dt>{{ t('notification.projectMemberAdded.detail.workspace') }}</dt>
              <dd>{{ detail.workspaceName }}</dd>
            </div>
            <div class="project-member-added-detail-dialog__detail-row">
              <dt>{{ t('notification.projectMemberAdded.detail.role') }}</dt>
              <dd>{{ roleLabel }}</dd>
            </div>
            <div class="project-member-added-detail-dialog__detail-row">
              <dt>{{ t('notification.projectMemberAdded.detail.joinedAt') }}</dt>
              <dd>{{ joinedAtLabel }}</dd>
            </div>
          </dl>
        </section>
      </template>

      <div class="project-member-added-detail-dialog__divider" aria-hidden="true"></div>

      <footer class="project-member-added-detail-dialog__actions">
        <Button
          variant="outline"
          class="project-member-added-detail-dialog__dismiss-action"
          @click="closeDialog"
        >
          {{ t('notification.projectMemberAdded.detail.dismiss') }}
        </Button>
        <Button
          class="project-member-added-detail-dialog__project-action"
          :disabled="viewState !== 'loaded' || !detail"
          @click="openProject"
        >
          {{ t('notification.projectMemberAdded.detail.openProject') }}
          <ArrowRight :size="18" :stroke-width="2" aria-hidden="true" />
        </Button>
      </footer>

      <p v-if="detail" class="project-member-added-detail-dialog__availability-note">
        {{
          t('notification.projectMemberAdded.detail.availability', {
            workspace: detail.workspaceName,
          })
        }}
      </p>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMediaQuery } from '@vueuse/core';
import { ArrowRight, Check, CircleAlert, UsersRound, X } from 'lucide-vue-next';
import type { ProjectMemberAddedNotificationDetail } from '@kanban/contracts/project';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getProjectMemberAddedNotificationDetailApi } from '@/services/project';

type ViewState = 'loading' | 'loaded' | 'error';

const props = defineProps<{ notificationId: string | null }>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{
  openProject: [detail: ProjectMemberAddedNotificationDetail];
}>();
const { locale, t } = useI18n();
const isMobile = useMediaQuery('(max-width: 640px)');

const detail = ref<ProjectMemberAddedNotificationDetail | null>(null);
const viewState = ref<ViewState>('loading');
let loadRequestId = 0;

const projectInitial = computed(
  () => detail.value?.projectName.trim().charAt(0).toUpperCase() || 'P',
);
const inviterInitial = computed(
  () => detail.value?.inviterName?.trim().charAt(0).toUpperCase() || 'F',
);
const headingDescription = computed(() =>
  t(
    isMobile.value
      ? 'notification.projectMemberAdded.detail.mobileDescription'
      : 'notification.projectMemberAdded.detail.description',
  ),
);
const roleLabel = computed(() => {
  if (!detail.value) return '';
  return t(`workspace.projectMembers.roles.${detail.value.role}.label`);
});
const joinedAtLabel = computed(() => {
  if (!detail.value) return '';
  const joinedAt = new Date(detail.value.joinedAt);
  if (Number.isNaN(joinedAt.getTime())) {
    return t('notification.projectMemberAdded.detail.unknownJoinedAt');
  }

  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(joinedAt);
});

const loadDetail = async () => {
  if (!props.notificationId) return;
  const requestId = ++loadRequestId;
  detail.value = null;
  viewState.value = 'loading';

  try {
    const response = await getProjectMemberAddedNotificationDetailApi(props.notificationId);
    if (requestId !== loadRequestId) return;
    if (!response.data) throw new Error('Missing project member notification detail');
    detail.value = response.data;
    viewState.value = 'loaded';
  } catch {
    if (requestId === loadRequestId) viewState.value = 'error';
  }
};

const closeDialog = () => {
  open.value = false;
};

const openProject = () => {
  if (!detail.value || viewState.value !== 'loaded') return;
  const currentDetail = detail.value;
  open.value = false;
  emit('openProject', currentDetail);
};

const handleOpenChange = (value: boolean) => {
  open.value = value;
};

watch(
  () => [open.value, props.notificationId] as const,
  ([isOpen, notificationId]) => {
    if (isOpen && notificationId) void loadDetail();
    if (!isOpen) loadRequestId += 1;
  },
  { immediate: true },
);
</script>

<style scoped src="./ProjectMemberAddedNotificationDetailDialog.css"></style>
