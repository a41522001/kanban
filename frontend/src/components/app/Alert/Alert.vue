<template>
  <AlertDialog :open="openFlag" @update:open="handleOpenChange">
    <AlertDialogContent
      class="w-full max-w-sm rounded-surface border-border bg-surface p-6 shadow-card sm:max-w-sm"
    >
      <AlertDialogHeader class="text-left">
        <AlertDialogTitle class="sr-only">{{ t('alert.title') }}</AlertDialogTitle>

        <div class="flex items-start gap-4">
          <span
            class="grid size-10 shrink-0 place-items-center rounded-full bg-action-primary-soft text-action-primary-hover"
            aria-hidden="true"
          >
            <CircleAlert :size="22" :stroke-width="2" />
          </span>

          <AlertDialogDescription
            class="min-w-0 pt-2 whitespace-pre-line text-sm font-bold leading-6 text-content-primary"
          >
            {{ content }}
          </AlertDialogDescription>
        </div>
      </AlertDialogHeader>

      <AlertDialogFooter class="mt-6 gap-3">
        <AlertDialogCancel
          v-if="hasCancel"
          :disabled="isProcessing"
          class="min-w-20 cursor-pointer rounded-control border-border-strong bg-surface px-4 py-2.5 text-sm font-bold text-content-primary hover:bg-surface-subtle focus-visible:ring-action-primary disabled:cursor-not-allowed disabled:opacity-60"
          @click.capture="void handleCancel()"
        >
          {{ cancelText }}
        </AlertDialogCancel>
        <AlertDialogAction
          :disabled="isProcessing"
          class="min-w-20 cursor-pointer rounded-control bg-action-primary px-4 py-2.5 text-sm font-bold text-content-on-dark hover:bg-action-primary-hover focus-visible:ring-action-primary disabled:cursor-not-allowed disabled:opacity-60"
          @click.capture="void handleConfirm()"
        >
          {{ confirmText }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { CircleAlert } from 'lucide-vue-next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAlertStore } from '@/stores/alert';

defineOptions({ name: 'AppAlert' });

const { t } = useI18n();
const alertStore = useAlertStore();
const { cancelText, confirmText, content, hasCancel, isProcessing, openFlag } =
  storeToRefs(alertStore);
const { closeAlert, handleCancel, handleConfirm } = alertStore;

const handleOpenChange = (isOpen: boolean) => {
  if (!isOpen && !isProcessing.value) {
    closeAlert();
  }
};
</script>
