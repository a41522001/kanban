<template>
  <article
    class="notification-item"
    :class="{
      'notification-item--unread': isUnread,
      'notification-item--has-read-action':
        isUnread || readState === 'processing' || readState === 'error',
    }"
  >
    <span class="notification-item__avatar" aria-hidden="true">
      {{ actorInitial }}
    </span>

    <button
      v-if="interactive"
      type="button"
      class="notification-item__copy notification-item__copy--interactive"
      :aria-label="openLabel"
      @click="emit('open')"
    >
      <p class="notification-item__eyebrow">{{ eyebrow }}</p>
      <p class="notification-item__title">{{ title }}</p>
      <p v-if="body" class="notification-item__body">{{ body }}</p>
      <time class="notification-item__time" :datetime="createdAt">
        {{ createdAtLabel }}
      </time>
    </button>
    <div v-else class="notification-item__copy">
      <p class="notification-item__eyebrow">{{ eyebrow }}</p>
      <p class="notification-item__title">{{ title }}</p>
      <p v-if="body" class="notification-item__body">{{ body }}</p>
      <time class="notification-item__time" :datetime="createdAt">
        {{ createdAtLabel }}
      </time>
    </div>

    <NotificationReadAction
      v-if="isUnread || readState === 'processing' || readState === 'error'"
      class="notification-item__read-action"
      scope="single"
      :state="readState"
      @click="emit('markRead')"
    />
  </article>
</template>

<script setup lang="ts">
import NotificationReadAction from '@/components/notifications/NotificationReadAction/NotificationReadAction.vue';
import type { NotificationReadActionState } from '@/types/notification';

interface Props {
  actorInitial: string;
  eyebrow: string;
  title: string;
  body?: string;
  createdAt: string;
  createdAtLabel: string;
  isUnread: boolean;
  readState?: NotificationReadActionState;
  interactive?: boolean;
  openLabel?: string;
}

defineProps<Props>();
const emit = defineEmits<{
  markRead: [];
  open: [];
}>();
</script>

<style scoped src="./NotificationItem.css"></style>
