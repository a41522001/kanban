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
                <article
                  class="notification-menu__item"
                  :class="{ 'notification-menu__item--unread': item.isUnread }"
                >
                  <span class="notification-menu__avatar" aria-hidden="true">
                    {{ item.actorInitial }}
                  </span>

                  <div class="notification-menu__copy">
                    <p class="notification-menu__eyebrow">
                      {{ item.eyebrow }}
                    </p>
                    <p class="notification-menu__item-title">
                      {{ item.title }}
                    </p>
                    <p v-if="item.body" class="notification-menu__body">
                      {{ item.body }}
                    </p>
                    <time class="notification-menu__time" :datetime="item.createdAt">
                      {{ item.createdAtLabel }}
                    </time>
                  </div>

                  <span
                    v-if="item.isUnread"
                    class="notification-menu__unread-dot"
                    :aria-label="t('notification.unread')"
                  ></span>
                </article>
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
import type { JsonObject, PublicNotification } from '@kanban/contracts/notification';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotificationStore } from '@/stores/notification';

interface NotificationPresentation {
  actorInitial: string;
  eyebrow: string;
  title: string;
  body?: string;
}

interface NotificationItemView extends NotificationPresentation {
  id: string;
  isUnread: boolean;
  createdAt: string;
  createdAtLabel: string;
}

const { locale, t } = useI18n();
const notificationStore = useNotificationStore();
const { hasLoadError, isLoading, notifications, unreadCount } = storeToRefs(notificationStore);
const { loadUnreadCount, refreshNotifications } = notificationStore;
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

const notificationItems = computed<NotificationItemView[]>(() => {
  return notifications.value.map((notification) => {
    const presentation = getPresentation(notification);

    return {
      id: notification.id,
      isUnread: notification.readAt === null,
      createdAt: notification.createdAt,
      createdAtLabel: formatCreatedAt(notification.createdAt),
      actorInitial: presentation.actorInitial,
      eyebrow: presentation.eyebrow,
      title: presentation.title,
      body: presentation.body,
    };
  });
});

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
