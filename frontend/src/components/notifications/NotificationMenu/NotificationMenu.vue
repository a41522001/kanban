<template>
  <DropdownMenu v-model:open="isOpen">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        class="notification-menu__trigger"
        :class="{ 'notification-menu__trigger--open': isOpen }"
        :aria-label="t('notification.open')"
      >
        <Bell :size="20" :stroke-width="2" aria-hidden="true" />
        <Badge v-if="unreadCount > 0" class="notification-menu__trigger-badge">
          {{ visibleUnreadCount }}
        </Badge>
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent
      align="end"
      :collision-padding="16"
      :side-offset="8"
      class="notification-menu__content"
    >
      <section class="notification-menu__panel" :aria-labelledby="titleId">
        <header class="notification-menu__header">
          <h2 :id="titleId" class="notification-menu__title">
            {{ t('notification.title') }}
          </h2>

          <span v-if="isLoading" class="notification-menu__state-label">
            {{ t('notification.loading') }}
          </span>
          <span v-else-if="hasLoadError" class="notification-menu__state-label">
            {{ t('notification.unavailable') }}
          </span>
          <Badge v-else class="notification-menu__count-badge">
            {{ t('notification.unreadCount', { count: unreadCount }) }}
          </Badge>
        </header>

        <div class="notification-menu__divider"></div>

        <div
          v-if="isLoading"
          class="notification-menu__loading"
          aria-busy="true"
          :aria-label="t('notification.loading')"
        >
          <div v-for="index in 3" :key="index" class="notification-menu__skeleton-row">
            <Skeleton class="notification-menu__skeleton-avatar" />
            <div class="notification-menu__skeleton-copy">
              <Skeleton class="notification-menu__skeleton-title" />
              <Skeleton
                class="notification-menu__skeleton-body"
                :class="{ 'notification-menu__skeleton-body--short': index === 2 }"
              />
            </div>
          </div>
        </div>

        <div v-else-if="hasLoadError" class="notification-menu__state" role="alert">
          <span class="notification-menu__state-icon notification-menu__state-icon--error">
            <CircleAlert :size="24" :stroke-width="2" aria-hidden="true" />
          </span>
          <h3>{{ t('notification.errorTitle') }}</h3>
          <p>{{ t('notification.errorDescription') }}</p>
          <Button size="sm" @click="refreshNotifications">
            {{ t('notification.retry') }}
          </Button>
        </div>

        <div v-else-if="notificationItems.length === 0" class="notification-menu__state">
          <span class="notification-menu__state-icon">
            <Bell :size="24" :stroke-width="2" aria-hidden="true" />
          </span>
          <h3>{{ t('notification.emptyTitle') }}</h3>
          <p>{{ t('notification.emptyDescription') }}</p>
        </div>

        <template v-else>
          <ScrollArea class="notification-menu__scroll-area">
            <ul class="notification-menu__list" :aria-label="t('notification.listLabel')">
              <li v-for="item in notificationItems" :key="item.id">
                <WorkspaceInvitationResponseCard
                  v-if="item.kind === 'workspace-invitation'"
                  :actor-initial="item.actorInitial"
                  :inviter-display-name="item.inviterDisplayName"
                  :workspace-name="item.workspaceName"
                  :created-at="item.createdAt"
                  :created-at-label="item.createdAtLabel"
                  :expires-at-label="item.expiresAtLabel"
                  :is-unread="item.isUnread"
                  :state="getInvitationState(item)"
                  @accept="respondToInvitation(item, 'accept')"
                  @decline="respondToInvitation(item, 'decline')"
                  @reload="reloadInvitation(item.id)"
                  @open-workspace="openWorkspace(item)"
                />
                <NotificationItem
                  v-else
                  :actor-initial="item.actorInitial"
                  :eyebrow="item.eyebrow"
                  :title="item.title"
                  :body="item.body"
                  :created-at="item.createdAt"
                  :created-at-label="item.createdAtLabel"
                  :is-unread="item.isUnread"
                />
              </li>
            </ul>
          </ScrollArea>

          <p class="notification-menu__footer-hint">
            {{ t('notification.recentHint') }}
          </p>
        </template>
      </section>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { Bell, CircleAlert } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import type { JsonObject, PublicNotification } from '@kanban/contracts/notification';
import NotificationItem from '@/components/notifications/NotificationItem/NotificationItem.vue';
import WorkspaceInvitationResponseCard from '@/components/notifications/WorkspaceInvitationResponseCard/WorkspaceInvitationResponseCard.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  acceptWorkspaceInvitationApi,
  declineWorkspaceInvitationApi,
} from '@/services/workspaceInvitation';
import { getApiErrorResponse } from '@/services/http';
import { ApiCode } from '@kanban/contracts/api';
import { useNotificationStore } from '@/stores/notification';
import { useWorkspaceStore } from '@/stores/workspace';
import type {
  WorkspaceInvitationResponseAction,
  WorkspaceInvitationResponseState,
} from '@/types/workspaceInvitation';

interface NotificationPresentation {
  actorInitial: string;
  eyebrow: string;
  title: string;
  body?: string;
}

interface NotificationItemBase {
  id: string;
  isUnread: boolean;
  createdAt: string;
  createdAtLabel: string;
}

interface GenericNotificationItem extends NotificationItemBase, NotificationPresentation {
  kind: 'generic';
}

interface WorkspaceInvitationItem extends NotificationItemBase {
  kind: 'workspace-invitation';
  invitationId: string;
  workspaceId: string | null;
  inviterDisplayName: string;
  workspaceName: string;
  actorInitial: string;
  expiresAt: string | null;
  expiresAtLabel?: string;
}

type NotificationItemView = GenericNotificationItem | WorkspaceInvitationItem;

const { locale, t } = useI18n();
const router = useRouter();
const notificationStore = useNotificationStore();
const workspaceStore = useWorkspaceStore();
const { hasLoadError, isLoading, notifications, unreadCount } = storeToRefs(notificationStore);
const {
  clearInvitationResponseState,
  getInvitationResponseState,
  loadUnreadCount,
  refreshNotifications,
  setInvitationResponseState,
} = notificationStore;
const { loadWorkspaces, selectWorkspace } = workspaceStore;
const isOpen = ref(false);
const titleId = 'notification-menu-title';

const visibleUnreadCount = computed(() => (unreadCount.value > 99 ? '99+' : unreadCount.value));

const isJsonObject = (value: PublicNotification['payload']): value is JsonObject => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const getPayloadText = (payload: PublicNotification['payload'], key: string) => {
  if (!isJsonObject(payload)) {
    return undefined;
  }

  const value = payload[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
};

const getPresentation = (notification: PublicNotification): NotificationPresentation => {
  if (notification.type === 'WORKSPACE_INVITED') {
    const inviterDisplayName =
      getPayloadText(notification.payload, 'inviterDisplayName') ?? t('notification.fallbackActor');
    const workspaceName =
      getPayloadText(notification.payload, 'workspaceName') ?? t('notification.fallbackWorkspace');

    return {
      actorInitial: inviterDisplayName.charAt(0).toUpperCase() || 'F',
      eyebrow: t('notification.types.workspaceInvited'),
      title: t('notification.workspaceInvited.title', {
        inviter: inviterDisplayName,
        workspace: workspaceName,
      }),
      body: t('notification.workspaceInvited.body'),
    };
  }

  return {
    actorInitial: 'F',
    eyebrow: t('notification.types.activity'),
    title: t('notification.genericTitle'),
  };
};

const formatCreatedAt = (value: string) => {
  const createdAt = new Date(value);

  if (Number.isNaN(createdAt.getTime())) {
    return t('notification.unknownTime');
  }

  const differenceInSeconds = Math.round((createdAt.getTime() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(differenceInSeconds);
  const relativeTime = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' });

  if (absoluteSeconds < 60) {
    return t('notification.justNow');
  }

  if (absoluteSeconds < 3600) {
    return relativeTime.format(Math.round(differenceInSeconds / 60), 'minute');
  }

  if (absoluteSeconds < 86400) {
    return relativeTime.format(Math.round(differenceInSeconds / 3600), 'hour');
  }

  if (absoluteSeconds < 604800) {
    return relativeTime.format(Math.round(differenceInSeconds / 86400), 'day');
  }

  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    day: 'numeric',
  }).format(createdAt);
};

const formatExpiresAt = (value: string | null) => {
  if (!value) {
    return undefined;
  }

  const expiresAt = new Date(value);
  if (Number.isNaN(expiresAt.getTime())) {
    return undefined;
  }

  const differenceInMilliseconds = expiresAt.getTime() - Date.now();
  if (differenceInMilliseconds <= 0) {
    return t('notification.workspaceInvited.expired');
  }

  const hours = Math.ceil(differenceInMilliseconds / 3_600_000);
  if (hours < 24) {
    return t('notification.workspaceInvited.expiresInHours', { count: hours });
  }

  return t('notification.workspaceInvited.expiresInDays', { count: Math.ceil(hours / 24) });
};

const notificationItems = computed<NotificationItemView[]>(() => {
  return notifications.value.map((notification) => {
    const presentation = getPresentation(notification);
    const base = {
      id: notification.id,
      isUnread: notification.readAt === null,
      createdAt: notification.createdAt,
      createdAtLabel: formatCreatedAt(notification.createdAt),
    };

    if (
      notification.type === 'WORKSPACE_INVITED' &&
      notification.resourceType === 'WORKSPACE_INVITATION' &&
      notification.resourceId
    ) {
      const inviterDisplayName =
        getPayloadText(notification.payload, 'inviterDisplayName') ??
        t('notification.fallbackActor');
      const workspaceName =
        getPayloadText(notification.payload, 'workspaceName') ??
        t('notification.fallbackWorkspace');

      return {
        ...base,
        kind: 'workspace-invitation' as const,
        invitationId: notification.resourceId,
        workspaceId: notification.workspaceId,
        inviterDisplayName,
        workspaceName,
        actorInitial: inviterDisplayName.charAt(0).toUpperCase() || 'F',
        expiresAt: notification.expiresAt,
        expiresAtLabel: formatExpiresAt(notification.expiresAt),
      };
    }

    return {
      ...base,
      kind: 'generic' as const,
      actorInitial: presentation.actorInitial,
      eyebrow: presentation.eyebrow,
      title: presentation.title,
      body: presentation.body,
    };
  });
});

const getInvitationState = (item: WorkspaceInvitationItem): WorkspaceInvitationResponseState => {
  const storedState = getInvitationResponseState(item.id);
  if (storedState) {
    return storedState;
  }

  if (item.expiresAt) {
    const expiresAt = new Date(item.expiresAt);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
      return 'error';
    }
  }

  return 'pending';
};

const respondToInvitation = async (
  item: WorkspaceInvitationItem,
  action: WorkspaceInvitationResponseAction,
) => {
  if (getInvitationState(item) !== 'pending') {
    return;
  }

  setInvitationResponseState(item.id, action === 'accept' ? 'accepting' : 'declining');

  try {
    const request = { invitationId: item.invitationId };
    if (action === 'accept') {
      await acceptWorkspaceInvitationApi(request);
      setInvitationResponseState(item.id, 'accepted');
      await loadWorkspaces();
      if (
        item.workspaceId &&
        !workspaceStore.workspaces.some((workspace) => workspace.id === item.workspaceId)
      ) {
        await loadWorkspaces();
      }
      toast.success(t('notification.workspaceInvited.acceptedToast'));
      return;
    }

    await declineWorkspaceInvitationApi(request);
    setInvitationResponseState(item.id, 'declined');
    toast.success(t('notification.workspaceInvited.declinedToast'));
  } catch (error: unknown) {
    if (getApiErrorResponse(error)?.code === ApiCode.ResourceNotFound) {
      clearInvitationResponseState(item.id);
      await refreshNotifications();
      toast.error(t('notification.workspaceInvited.responseError'));
      return;
    }

    setInvitationResponseState(item.id, 'error');
    toast.error(t('notification.workspaceInvited.responseError'));
  }
};

const reloadInvitation = async (notificationId: string) => {
  clearInvitationResponseState(notificationId);
  await refreshNotifications();
};

const openWorkspace = (item: WorkspaceInvitationItem) => {
  if (item.workspaceId) {
    selectWorkspace(item.workspaceId);
  }

  isOpen.value = false;
  void router.push({ name: 'workspace' });
};

watch(isOpen, (open) => {
  if (open) {
    void refreshNotifications();
  }
});

onMounted(() => {
  void loadUnreadCount();
});
</script>

<style scoped src="./NotificationMenu.css"></style>
