<template>
  <article class="notification-item" :class="{ 'notification-item--unread': isUnread }">
    <span class="notification-item__avatar" aria-hidden="true">
      {{ actorInitial }}
    </span>

    <div class="notification-item__copy">
      <p class="notification-item__eyebrow">{{ eyebrow }}</p>
      <p class="notification-item__title">{{ title }}</p>
      <p v-if="body" class="notification-item__body">{{ body }}</p>
      <time class="notification-item__time" :datetime="createdAt">
        {{ createdAtLabel }}
      </time>
    </div>

    <span
      v-if="isUnread"
      class="notification-item__unread-dot"
      :aria-label="t('notification.unread')"
    ></span>
  </article>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

interface Props {
  actorInitial: string;
  eyebrow: string;
  title: string;
  body?: string;
  createdAt: string;
  createdAtLabel: string;
  isUnread: boolean;
}

defineProps<Props>();

const { t } = useI18n();
</script>

<style scoped src="./NotificationItem.css"></style>
