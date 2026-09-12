<template>
  <article
    class="workspace-invitation-card"
    :class="[
      `workspace-invitation-card--${state}`,
      { 'workspace-invitation-card--unread': isUnread && state === 'pending' },
      {
        'workspace-invitation-card--has-read-action':
          state !== 'error' &&
          ((state === 'pending' && isUnread) ||
            readState === 'processing' ||
            readState === 'error'),
      },
    ]"
    :aria-live="state === 'pending' ? undefined : 'polite'"
  >
    <NotificationReadAction
      v-if="
        state !== 'error' &&
        ((state === 'pending' && isUnread) ||
          readState === 'processing' ||
          readState === 'error')
      "
      class="workspace-invitation-card__read-action"
      scope="single"
      :state="readState"
      @click="emit('markRead')"
    />
    <template v-if="state === 'error'">
      <span class="workspace-invitation-card__error-icon" aria-hidden="true">
        <CircleAlert :size="20" :stroke-width="2" />
      </span>
      <div class="workspace-invitation-card__error-copy" role="alert">
        <p class="workspace-invitation-card__error-title">
          {{ t('notification.workspaceInvited.errorTitle') }}
        </p>
        <p class="workspace-invitation-card__body">
          {{ t('notification.workspaceInvited.errorDescription') }}
        </p>
        <Button size="sm" class="workspace-invitation-card__reload" @click="emit('reload')">
          {{ t('notification.retry') }}
        </Button>
      </div>
    </template>

    <template v-else>
      <span class="workspace-invitation-card__avatar" aria-hidden="true">
        <Check v-if="state === 'accepted'" :size="20" :stroke-width="2.5" />
        <X v-else-if="state === 'declined'" :size="19" :stroke-width="2.5" />
        <template v-else>{{ actorInitial }}</template>
      </span>

      <div class="workspace-invitation-card__copy">
        <div class="workspace-invitation-card__meta">
          <p class="workspace-invitation-card__eyebrow">{{ eyebrow }}</p>
          <span class="workspace-invitation-card__status">{{ statusLabel }}</span>
        </div>

        <p class="workspace-invitation-card__title">{{ title }}</p>
        <p class="workspace-invitation-card__body">{{ body }}</p>

        <time class="workspace-invitation-card__time" :datetime="createdAt">
          {{ timeLabel }}
        </time>

        <div v-if="showsResponseActions" class="workspace-invitation-card__actions">
          <Button
            :loading="state === 'accepting'"
            :disabled="isResponding"
            class="workspace-invitation-card__action"
            @click="emit('accept')"
          >
            <Check v-if="state !== 'accepting'" :size="17" :stroke-width="2.5" aria-hidden="true" />
            {{
              state === 'accepting'
                ? t('notification.workspaceInvited.accepting')
                : t('notification.workspaceInvited.accept')
            }}
          </Button>
          <Button
            variant="outline"
            :loading="state === 'declining'"
            :disabled="isResponding"
            class="workspace-invitation-card__action"
            @click="emit('decline')"
          >
            <X v-if="state !== 'declining'" :size="17" :stroke-width="2.5" aria-hidden="true" />
            {{
              state === 'declining'
                ? t('notification.workspaceInvited.declining')
                : t('notification.workspaceInvited.decline')
            }}
          </Button>
        </div>

        <Button
          v-else-if="state === 'accepted'"
          variant="secondary"
          class="workspace-invitation-card__workspace-link"
          @click="emit('openWorkspace')"
        >
          {{ t('notification.workspaceInvited.openWorkspace') }}
          <ArrowRight :size="17" :stroke-width="2.5" aria-hidden="true" />
        </Button>
      </div>

      <span
        v-if="isUnread && state === 'pending'"
        class="workspace-invitation-card__unread-dot"
        :aria-label="t('notification.unread')"
      ></span>
    </template>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ArrowRight, Check, CircleAlert, X } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import NotificationReadAction from '@/components/notifications/NotificationReadAction/NotificationReadAction.vue';
import type { NotificationReadActionState } from '@/types/notification';
import type { WorkspaceInvitationResponseState } from '@/types/workspaceInvitation';

interface Props {
  actorInitial: string;
  inviterDisplayName: string;
  workspaceName: string;
  createdAt: string;
  createdAtLabel: string;
  expiresAtLabel?: string;
  isUnread: boolean;
  readState?: NotificationReadActionState;
  state: WorkspaceInvitationResponseState;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  accept: [];
  decline: [];
  markRead: [];
  reload: [];
  openWorkspace: [];
}>();

const { t } = useI18n();

const isResponding = computed(() => props.state === 'accepting' || props.state === 'declining');
const showsResponseActions = computed(
  () => props.state === 'pending' || props.state === 'accepting' || props.state === 'declining',
);

const eyebrow = computed(() => {
  if (props.state === 'accepted') {
    return t('notification.workspaceInvited.acceptedEyebrow');
  }

  if (props.state === 'declined') {
    return t('notification.workspaceInvited.declinedEyebrow');
  }

  return t('notification.types.workspaceInvited');
});

const statusLabel = computed(() => {
  if (isResponding.value) {
    return t('notification.workspaceInvited.processingStatus');
  }

  if (props.state === 'accepted') {
    return t('notification.workspaceInvited.joinedStatus');
  }

  if (props.state === 'declined') {
    return t('notification.workspaceInvited.respondedStatus');
  }

  return t('notification.workspaceInvited.pendingStatus');
});

const title = computed(() => {
  if (props.state === 'accepting') {
    return t('notification.workspaceInvited.acceptingTitle', { workspace: props.workspaceName });
  }

  if (props.state === 'declining') {
    return t('notification.workspaceInvited.decliningTitle', { workspace: props.workspaceName });
  }

  if (props.state === 'accepted') {
    return t('notification.workspaceInvited.acceptedTitle', { workspace: props.workspaceName });
  }

  if (props.state === 'declined') {
    return t('notification.workspaceInvited.declinedTitle', { workspace: props.workspaceName });
  }

  return t('notification.workspaceInvited.title', {
    inviter: props.inviterDisplayName,
    workspace: props.workspaceName,
  });
});

const body = computed(() => {
  if (isResponding.value) {
    return t('notification.workspaceInvited.processingDescription');
  }

  if (props.state === 'accepted') {
    return t('notification.workspaceInvited.acceptedDescription');
  }

  if (props.state === 'declined') {
    return t('notification.workspaceInvited.declinedDescription');
  }

  return t('notification.workspaceInvited.body');
});

const timeLabel = computed(() => {
  if (props.state === 'accepted' || props.state === 'declined') {
    return t('notification.justNow');
  }

  return props.expiresAtLabel
    ? `${props.createdAtLabel} · ${props.expiresAtLabel}`
    : props.createdAtLabel;
});
</script>

<style scoped src="./WorkspaceInvitationResponseCard.css"></style>
