import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

type AlertAction = () => void | Promise<void>;

export interface AlertOption {
  content: string;
  confirm?: AlertAction;
  cancel?: AlertAction;
  confirmText?: string;
  cancelText?: string;
}

const defaultConfirmText = '確認';
const defaultCancelText = '取消';

export const useAlertStore = defineStore('alertStore', () => {
  const content = ref<string>('');
  const confirmText = ref<string>(defaultConfirmText);
  const cancelText = ref<string>(defaultCancelText);
  const openFlag = ref<boolean>(false);
  const isProcessing = ref<boolean>(false);
  const confirmAction = ref<AlertAction | null>(null);
  const cancelAction = ref<AlertAction | null>(null);
  const hasCancel = computed<boolean>(() => cancelAction.value !== null);

  const openAlert = (option: AlertOption) => {
    content.value = option.content;
    confirmText.value = option.confirmText ?? defaultConfirmText;
    cancelText.value = option.cancelText ?? defaultCancelText;
    confirmAction.value = option.confirm ?? null;
    cancelAction.value = option.cancel ?? null;
    openFlag.value = true;
  };

  const closeAlert = () => {
    openFlag.value = false;
    content.value = '';
    confirmText.value = defaultConfirmText;
    cancelText.value = defaultCancelText;
    confirmAction.value = null;
    cancelAction.value = null;
  };

  const runAction = async (action: AlertAction | null) => {
    if (isProcessing.value) {
      return;
    }

    isProcessing.value = true;
    try {
      await action?.();
    } finally {
      isProcessing.value = false;
      closeAlert();
    }
  };

  const handleConfirm = () => runAction(confirmAction.value);
  const handleCancel = () => runAction(cancelAction.value);

  return {
    content,
    confirmText,
    cancelText,
    openFlag,
    isProcessing,
    hasCancel,
    openAlert,
    closeAlert,
    handleConfirm,
    handleCancel,
  };
});
