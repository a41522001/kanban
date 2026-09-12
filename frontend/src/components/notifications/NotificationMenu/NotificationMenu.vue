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

          <div class="notification-menu__header-actions">
            <span v-if="isLoading" class="notification-menu__state-label">
              {{ t('notification.loading') }}
            </span>
            <span v-else-if="hasLoadError" class="notification-menu__state-label">
              {{ t('notification.unavailable') }}
            </span>
            <Badge v-else class="notification-menu__count-badge">
              {{ t('notification.unreadCount', { count: unreadCount }) }}
            </Badge>
            <NotificationReadAction
              v-if="showMarkAllReadAction"
              scope="all"
              :state="markAllReadState"
              @click="markAllRead"
            />
          </div>
        </header>

        <p v-if="markAllReadState === 'error'" class="notification-menu__read-error" role="alert">
          {{ t('notification.readActions.errorDescription') }}
        </p>

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
                <NotificationItem
                  :actor-initial="item.actorInitial"
                  :eyebrow="item.eyebrow"
                  :title="item.title"
                  :body="item.body"
                  :created-at="item.createdAt"
                  :created-at-label="item.createdAtLabel"
                  :is-unread="item.isUnread"
                  :read-state="getNotificationReadState(item.id)"
                  @mark-read="markNotification(item.id)"
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
import { toast } from 'vue-sonner';
import type { PublicNotification } from '@kanban/contracts/notification';
import NotificationItem from '@/components/notifications/NotificationItem/NotificationItem.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import NotificationReadAction from '@/components/notifications/NotificationReadAction/NotificationReadAction.vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorResponse } from '@/services/http';
import { useNotificationStore } from '@/stores/notification';

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

type NotificationItemView = GenericNotificationItem;

const { locale, t } = useI18n();
const notificationStore = useNotificationStore();
const {
  hasLoadError,
  isLoading,
  notifications,
  unreadCount,
  notificationReadStates,
  markAllReadState,
} = storeToRefs(notificationStore);
const { loadUnreadCount, markAllNotificationsRead, markNotificationRead, refreshNotifications } =
  notificationStore;
const isOpen = ref(false);
const titleId = 'notification-menu-title';

const visibleUnreadCount = computed(() => (unreadCount.value > 99 ? '99+' : unreadCount.value));

const getPresentation = (notification: PublicNotification): NotificationPresentation => {
  if (notification.type === 'WORKSPACE_INVITED') {
    return {
      actorInitial: 'F',
      eyebrow: t('notification.types.workspaceInvited'),
      title: t('notification.workspaceInvited.summaryTitle'),
      body: t('notification.workspaceInvited.summaryBody'),
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

const notificationItems = computed<NotificationItemView[]>(() => {
  return notifications.value.map((notification) => {
    const presentation = getPresentation(notification);
    const base = {
      id: notification.id,
      isUnread: notification.readAt === null,
      createdAt: notification.createdAt,
      createdAtLabel: formatCreatedAt(notification.createdAt),
    };

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

const showMarkAllReadAction = computed(
  () =>
    !isLoading.value &&
    !hasLoadError.value &&
    notificationItems.value.length > 0 &&
    (unreadCount.value > 0 || markAllReadState.value !== 'default'),
);

const getNotificationReadState = (notificationId: string) => {
  return notificationReadStates.value[notificationId] ?? 'default';
};

const markNotification = async (notificationId: string) => {
  try {
    await markNotificationRead(notificationId);
  } catch (error: unknown) {
    toast.error(
      getApiErrorResponse(error)?.message ?? t('notification.readActions.errorDescription'),
    );
  }
};

const markAllRead = async () => {
  try {
    await markAllNotificationsRead();
    toast.success(t('notification.readActions.complete'));
  } catch (error: unknown) {
    toast.error(
      getApiErrorResponse(error)?.message ?? t('notification.readActions.errorDescription'),
    );
  }
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
