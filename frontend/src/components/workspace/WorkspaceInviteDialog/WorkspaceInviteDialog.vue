<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent
      class="workspace-invite-dialog"
      :show-close-button="false"
      @escape-key-down="handleDismissAttempt"
      @open-auto-focus="handleOpenAutoFocus"
      @pointer-down-outside="handleDismissAttempt"
    >
      <DialogHeader class="workspace-invite-dialog__header">
        <div class="workspace-invite-dialog__heading-copy">
          <DialogTitle class="workspace-invite-dialog__title">
            {{ t('workplace.invite.title') }}
          </DialogTitle>
          <DialogDescription class="workspace-invite-dialog__description">
            {{ t('workplace.invite.description') }}
          </DialogDescription>
        </div>

        <button
          type="button"
          class="workspace-invite-dialog__close"
          :disabled="isSubmitting"
          :aria-label="t('workplace.invite.close')"
          @click="closeDialog"
        >
          <X :size="18" :stroke-width="2" aria-hidden="true" />
        </button>
      </DialogHeader>

      <section
        class="workspace-invite-dialog__workspace"
        :aria-label="t('workplace.invite.context')"
      >
        <span class="workspace-invite-dialog__monogram" aria-hidden="true">
          {{ workspaceMonogram }}
        </span>
        <span class="workspace-invite-dialog__workspace-copy">
          <strong class="workspace-invite-dialog__workspace-name">{{ workspace.name }}</strong>
          <span class="workspace-invite-dialog__workspace-hint">
            {{ t('workplace.invite.workspaceHint') }}
          </span>
        </span>
        <Badge class="workspace-invite-dialog__role-badge">
          {{ t('workplace.invite.role') }}
        </Badge>
      </section>

      <form class="workspace-invite-dialog__form" novalidate @submit.prevent="handleSubmit">
        <FormField
          input-id="workspace-invite-email"
          :label="t('workplace.invite.emailLabel')"
          required
          :hint="t('workplace.invite.emailHint')"
          :error="emailError"
        >
          <template #default="{ invalid, describedBy }">
            <Input
              id="workspace-invite-email"
              v-model="email"
              type="email"
              autocomplete="email"
              clearable
              :disabled="isSubmitting"
              :placeholder="t('workplace.invite.emailPlaceholder')"
              :maxlength="emailMaxLength"
              :invalid="invalid"
              :aria-describedby="describedBy"
              @blur="hasTouchedEmail = true"
            />
          </template>
        </FormField>

        <div
          v-if="submitError"
          class="workspace-invite-dialog__submit-error"
          role="alert"
          aria-live="polite"
        >
          <CircleAlert :size="18" :stroke-width="2" aria-hidden="true" />
          <p>{{ submitError }}</p>
        </div>

        <DialogFooter class="workspace-invite-dialog__footer">
          <Button type="button" variant="outline" :disabled="isSubmitting" @click="closeDialog">
            {{ t('workplace.actions.cancel') }}
          </Button>
          <Button type="submit" :loading="isSubmitting">
            {{ isSubmitting ? t('workplace.invite.sending') : t('workplace.invite.send') }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { CircleAlert, X } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { ApiCode } from '@kanban/contracts/api';
import type { WorkspaceListItemDto } from '@kanban/contracts/workspaces';
import FormField from '@/components/shared/FormField/FormField.vue';
import Input from '@/components/shared/Input/Input.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { inviteWorkspaceMemberApi } from '@/services/workspaceInvitation';
import { getApiErrorResponse } from '@/services/http';

interface Props {
  workspace: WorkspaceListItemDto;
}

const props = defineProps<Props>();
const open = defineModel<boolean>('open', { default: false });
const { t } = useI18n();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailMaxLength = 320;
const email = ref('');
const hasTouchedEmail = ref(false);
const hasTriedSubmit = ref(false);
const isSubmitting = ref(false);
const serverEmailError = ref<string | undefined>();
const submitError = ref<string | undefined>();

const workspaceMonogram = computed(
  () => props.workspace.name.trim().charAt(0).toUpperCase() || '?',
);

const clientEmailError = computed(() => {
  if (!hasTouchedEmail.value && !hasTriedSubmit.value) {
    return undefined;
  }

  const normalizedEmail = email.value.trim();

  if (normalizedEmail === '') {
    return t('validation.required');
  }

  if (normalizedEmail.length > emailMaxLength) {
    return t('validation.emailMaxLength');
  }

  if (!emailPattern.test(normalizedEmail)) {
    return t('validation.email');
  }

  return undefined;
});

const emailError = computed(() => serverEmailError.value ?? clientEmailError.value);

const resetForm = () => {
  email.value = '';
  hasTouchedEmail.value = false;
  hasTriedSubmit.value = false;
  serverEmailError.value = undefined;
  submitError.value = undefined;
};

const closeDialog = () => {
  if (isSubmitting.value) {
    return;
  }

  open.value = false;
  resetForm();
};

const handleOpenChange = (isOpen: boolean) => {
  if (!isOpen) {
    closeDialog();
    return;
  }

  open.value = true;
};

const handleDismissAttempt = (event: Event) => {
  if (isSubmitting.value) {
    event.preventDefault();
  }
};

const handleOpenAutoFocus = (event: Event) => {
  event.preventDefault();
  void nextTick(() => {
    document.querySelector<HTMLInputElement>('#workspace-invite-email')?.focus();
  });
};

const handleSubmit = async () => {
  if (isSubmitting.value) {
    return;
  }

  hasTriedSubmit.value = true;
  serverEmailError.value = undefined;
  submitError.value = undefined;

  if (clientEmailError.value) {
    return;
  }

  isSubmitting.value = true;

  try {
    await inviteWorkspaceMemberApi({
      workspaceId: props.workspace.id,
      email: email.value.trim(),
    });
    toast.success(t('workplace.invite.success'));
    open.value = false;
    resetForm();
  } catch (error: unknown) {
    const response = getApiErrorResponse(error);
    const emailMessages = response?.error?.email?.messages;

    if (response?.code === ApiCode.ValidationError && emailMessages?.[0]) {
      serverEmailError.value = emailMessages[0];
      return;
    }

    if (response?.code === ApiCode.ResourceNotFound) {
      serverEmailError.value = response.message;
      return;
    }

    submitError.value = response?.message ?? t('workplace.invite.error');
  } finally {
    isSubmitting.value = false;
  }
};

watch(email, () => {
  serverEmailError.value = undefined;
  submitError.value = undefined;
});

watch(
  () => props.workspace.id,
  () => {
    if (!isSubmitting.value) {
      resetForm();
    }
  },
);
</script>

<style scoped src="./WorkspaceInviteDialog.css"></style>
