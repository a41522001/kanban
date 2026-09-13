<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent
      class="workspace-invitation-detail-dialog"
      :show-close-button="false"
      @escape-key-down="handleDismissAttempt"
      @pointer-down-outside="handleDismissAttempt"
    >
      <div class="workspace-invitation-detail-dialog__accent" aria-hidden="true"></div>

      <header class="workspace-invitation-detail-dialog__header">
        <div class="workspace-invitation-detail-dialog__identity">
          <span
            class="workspace-invitation-detail-dialog__avatar"
            :class="`workspace-invitation-detail-dialog__avatar--${viewState}`"
            aria-hidden="true"
          >
            <LoaderCircle v-if="viewState === 'loading'" class="animate-spin" :size="20" />
            <Check v-else-if="viewState === 'accepted'" :size="20" :stroke-width="2.5" />
            <X v-else-if="viewState === 'declined'" :size="20" :stroke-width="2.5" />
            <CircleAlert
              v-else-if="viewState === 'unavailable' || viewState === 'error'"
              :size="20"
            />
            <span v-else>{{ inviterInitial }}</span>
          </span>
          <div class="workspace-invitation-detail-dialog__heading">
            <DialogTitle>{{ headingTitle }}</DialogTitle>
            <DialogDescription>{{ headingDescription }}</DialogDescription>
          </div>
        </div>

        <button
          type="button"
          class="workspace-invitation-detail-dialog__close"
          :aria-label="t('notification.workspaceInvited.detail.close')"
          :disabled="isResponding"
          @click="closeDialog"
        >
          <X :size="20" :stroke-width="2" aria-hidden="true" />
        </button>
      </header>

      <section
        class="workspace-invitation-detail-dialog__card"
        :class="`workspace-invitation-detail-dialog__card--${viewState}`"
        aria-live="polite"
      >
        <template v-if="viewState === 'loading'">
          <Skeleton
            class="workspace-invitation-detail-dialog__skeleton workspace-invitation-detail-dialog__skeleton--title"
          />
          <Skeleton
            class="workspace-invitation-detail-dialog__skeleton workspace-invitation-detail-dialog__skeleton--line"
          />
          <Skeleton
            class="workspace-invitation-detail-dialog__skeleton workspace-invitation-detail-dialog__skeleton--line-short"
          />
        </template>

        <template v-else-if="viewState === 'error'">
          <p class="workspace-invitation-detail-dialog__card-label">
            {{ t('notification.workspaceInvited.detail.loadError') }}
          </p>
          <Button size="sm" variant="secondary" @click="loadDetail">
            {{ t('notification.workspaceInvited.detail.retry') }}
          </Button>
        </template>

        <template v-else>
          <p class="workspace-invitation-detail-dialog__card-label">{{ cardLabel }}</p>
          <p class="workspace-invitation-detail-dialog__workspace-name">
            {{ detail?.workspaceName ?? t('notification.fallbackWorkspace') }}
          </p>
          <p class="workspace-invitation-detail-dialog__body">{{ cardBody }}</p>
          <p v-if="viewState === 'pending'" class="workspace-invitation-detail-dialog__meta">
            {{ roleLabel }}<span aria-hidden="true"> · </span>{{ expiryLabel }}
          </p>
        </template>
      </section>

      <div class="workspace-invitation-detail-dialog__divider" aria-hidden="true"></div>

      <footer class="workspace-invitation-detail-dialog__actions">
        <template v-if="viewState === 'pending' || viewState === 'responding'">
          <Button
            :loading="responseAction === 'accept'"
            :disabled="isResponding"
            class="workspace-invitation-detail-dialog__accept"
            @click="respond('accept')"
          >
            <Check
              v-if="responseAction !== 'accept'"
              :size="18"
              :stroke-width="2.5"
              aria-hidden="true"
            />
            {{
              responseAction === 'accept'
                ? t('notification.workspaceInvited.detail.accepting')
                : t('notification.workspaceInvited.detail.accept')
            }}
          </Button>
          <Button
            variant="outline"
            :loading="responseAction === 'decline'"
            :disabled="isResponding"
            class="workspace-invitation-detail-dialog__decline"
            @click="respond('decline')"
          >
            <X
              v-if="responseAction !== 'decline'"
              :size="18"
              :stroke-width="2.5"
              aria-hidden="true"
            />
            {{
              responseAction === 'decline'
                ? t('notification.workspaceInvited.detail.declining')
                : t('notification.workspaceInvited.detail.decline')
            }}
          </Button>
        </template>
        <Button
          v-else
          variant="secondary"
          class="workspace-invitation-detail-dialog__done"
          @click="closeDialog"
        >
          {{
            viewState === 'error'
              ? t('notification.workspaceInvited.detail.retry')
              : t('notification.workspaceInvited.detail.done')
          }}
        </Button>
      </footer>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { CircleAlert, Check, LoaderCircle, X } from 'lucide-vue-next';
import { ApiCode } from '@kanban/contracts/api';
import type { WorkspaceInvitationDetail } from '@kanban/contracts/workspaceInvitation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  acceptWorkspaceInvitationApi,
  declineWorkspaceInvitationApi,
  getWorkspaceInvitationDetailApi,
} from '@/services/workspaceInvitation';
import { getApiErrorResponse } from '@/services/http';

type ViewState =
  'loading' | 'pending' | 'responding' | 'accepted' | 'declined' | 'unavailable' | 'error';
type ResponseAction = 'accept' | 'decline' | null;

const props = defineProps<{ invitationId: string | null }>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ accepted: []; declined: []; loaded: [WorkspaceInvitationDetail] }>();
const { locale, t } = useI18n();

const detail = ref<WorkspaceInvitationDetail | null>(null);
const viewState = ref<ViewState>('loading');
const responseAction = ref<ResponseAction>(null);
const loadError = ref(false);

const inviterInitial = computed(() => {
  const name = detail.value?.inviterName?.trim();
  return name ? name.charAt(0).toUpperCase() : 'F';
});
const isResponding = computed(() => viewState.value === 'responding');
const headingTitle = computed(() => {
  if (viewState.value === 'accepted')
    return t('notification.workspaceInvited.detail.acceptedTitle');
  if (viewState.value === 'declined')
    return t('notification.workspaceInvited.detail.declinedTitle');
  if (viewState.value === 'unavailable')
    return t('notification.workspaceInvited.detail.unavailableTitle');
  return t('notification.workspaceInvited.detail.pendingTitle');
});
const headingDescription = computed(() => {
  if (viewState.value === 'loading')
    return t('notification.workspaceInvited.detail.loadingDescription');
  if (viewState.value === 'accepted')
    return t('notification.workspaceInvited.detail.acceptedDescription');
  if (viewState.value === 'declined')
    return t('notification.workspaceInvited.detail.declinedDescription');
  if (viewState.value === 'unavailable')
    return t('notification.workspaceInvited.detail.unavailableDescription');
  if (viewState.value === 'responding')
    return t('notification.workspaceInvited.detail.pendingDescription');
  return t('notification.workspaceInvited.detail.pendingDescription');
});
const cardLabel = computed(() => {
  if (viewState.value === 'accepted')
    return t('notification.workspaceInvited.detail.acceptedDescription');
  if (viewState.value === 'declined')
    return t('notification.workspaceInvited.detail.declinedDescription');
  if (viewState.value === 'unavailable')
    return t('notification.workspaceInvited.detail.unavailableDescription');
  if (viewState.value === 'responding')
    return responseAction.value === 'accept'
      ? t('notification.workspaceInvited.detail.accept')
      : t('notification.workspaceInvited.detail.decline');
  return detail.value?.inviterName
    ? t('notification.workspaceInvited.detail.invitedBy', { inviter: detail.value.inviterName })
    : t('notification.workspaceInvited.detail.invitedBy', {
        inviter: t('notification.fallbackActor'),
      });
});
const cardBody = computed(() => {
  if (viewState.value === 'accepted') return t('notification.workspaceInvited.detail.acceptedBody');
  if (viewState.value === 'declined') return t('notification.workspaceInvited.detail.declinedBody');
  if (viewState.value === 'unavailable')
    return t('notification.workspaceInvited.detail.unavailableBody');
  if (viewState.value === 'responding')
    return t('notification.workspaceInvited.detail.loadingBody');
  return t('notification.workspaceInvited.detail.pendingBody');
});
const roleLabel = computed(() => t('notification.workspaceInvited.detail.memberRole'));
const expiryLabel = computed(() => {
  if (!detail.value) return '';
  const expiry = new Date(detail.value.expiresAt);
  if (Number.isNaN(expiry.getTime())) return t('notification.workspaceInvited.expired');
  return t('notification.workspaceInvited.detail.expiresIn', {
    date: new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric' }).format(expiry),
  });
});

const setDetailState = (invitation: WorkspaceInvitationDetail) => {
  detail.value = invitation;
  viewState.value =
    invitation.status === 'PENDING'
      ? 'pending'
      : invitation.status === 'ACCEPTED'
        ? 'accepted'
        : invitation.status === 'DECLINED'
          ? 'declined'
          : 'unavailable';
  emit('loaded', invitation);
};

const loadDetail = async () => {
  if (!props.invitationId) return;
  viewState.value = 'loading';
  loadError.value = false;
  try {
    const response = await getWorkspaceInvitationDetailApi(props.invitationId);
    if (!response.data) throw new Error('Missing invitation detail');
    setDetailState(response.data);
  } catch (error: unknown) {
    const apiError = getApiErrorResponse(error);
    viewState.value = apiError?.code === ApiCode.ResourceNotFound ? 'unavailable' : 'error';
    loadError.value = true;
  }
};

const respond = async (action: 'accept' | 'decline') => {
  if (!props.invitationId || isResponding.value || viewState.value !== 'pending') return;
  responseAction.value = action;
  viewState.value = 'responding';
  try {
    const request = { invitationId: props.invitationId };
    if (action === 'accept') {
      await acceptWorkspaceInvitationApi(request);
      viewState.value = 'accepted';
      toast.success(t('notification.workspaceInvited.acceptedToast'));
      emit('accepted');
    } else {
      await declineWorkspaceInvitationApi(request);
      viewState.value = 'declined';
      toast.success(t('notification.workspaceInvited.declinedToast'));
      emit('declined');
    }
  } catch (error: unknown) {
    viewState.value = 'pending';
    toast.error(
      getApiErrorResponse(error)?.message ?? t('notification.workspaceInvited.responseError'),
    );
  } finally {
    responseAction.value = null;
  }
};

const closeDialog = () => {
  if (!isResponding.value) open.value = false;
};
const handleOpenChange = (value: boolean) => {
  if (!value) closeDialog();
  else open.value = true;
};
const handleDismissAttempt = (event: Event) => {
  if (isResponding.value) event.preventDefault();
};

watch(
  () => [open.value, props.invitationId] as const,
  ([isOpen, invitationId]) => {
    if (isOpen && invitationId) void loadDetail();
  },
  { immediate: true },
);
</script>

<style scoped src="./WorkspaceInvitationDetailDialog.css"></style>
