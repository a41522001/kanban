<template>
  <button
    type="button"
    class="notification-read-action"
    :class="[
      `notification-read-action--${scope}`,
      `notification-read-action--${state}`,
    ]"
    :disabled="disabled || state === 'processing' || state === 'complete'"
    :aria-label="ariaLabel"
    :aria-busy="state === 'processing' || undefined"
    :title="scope === 'single' ? ariaLabel : undefined"
    @click="emit('click')"
  >
    <LoaderCircle v-if="state === 'processing'" class="notification-read-action__icon animate-spin" aria-hidden="true" />
    <CircleAlert v-else-if="state === 'error'" class="notification-read-action__icon" aria-hidden="true" />
    <CheckCheck v-else class="notification-read-action__icon" aria-hidden="true" />
    <span v-if="scope === 'all'" class="notification-read-action__label">
      {{ label }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { CheckCheck, CircleAlert, LoaderCircle } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import type { NotificationReadActionState } from '@/types/notification';

interface Props {
  scope: 'single' | 'all';
  state?: NotificationReadActionState;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  state: 'default',
  disabled: false,
});

const emit = defineEmits<{
  click: [];
}>();

const { t } = useI18n();

const label = computed(() => {
  if (props.state === 'processing') {
    return t('notification.readActions.processing');
  }

  if (props.state === 'complete') {
    return t('notification.readActions.complete');
  }

  return t('notification.readActions.markAll');
});

const ariaLabel = computed(() => {
  if (props.scope === 'single') {
    if (props.state === 'processing') {
      return t('notification.readActions.marking');
    }

    if (props.state === 'error') {
      return t('notification.readActions.retrySingle');
    }

    return t('notification.readActions.markSingle');
  }

  if (props.state === 'processing') {
    return t('notification.readActions.processing');
  }

  if (props.state === 'complete') {
    return t('notification.readActions.complete');
  }

  if (props.state === 'error') {
    return t('notification.readActions.retryAll');
  }

  return t('notification.readActions.markAll');
});
</script>

<style scoped src="./NotificationReadAction.css"></style>
