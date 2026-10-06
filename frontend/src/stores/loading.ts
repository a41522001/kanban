import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

export const useLoadingStore = defineStore('loadingStore', () => {
  const content = ref<string | null>(null);
  const pendingCount = ref<number>(0);
  const isLoading = computed<boolean>(() => pendingCount.value > 0);

  const showLoading = (message?: string) => {
    content.value = message?.trim() || null;
    pendingCount.value += 1;
  };

  const hideLoading = () => {
    pendingCount.value = Math.max(0, pendingCount.value - 1);

    if (pendingCount.value === 0) {
      content.value = null;
    }
  };

  const resetLoading = () => {
    pendingCount.value = 0;
    content.value = null;
  };

  const withLoading = async <T>(action: () => Promise<T>, message?: string): Promise<T> => {
    showLoading(message);
    try {
      return await action();
    } finally {
      hideLoading();
    }
  };

  return {
    content,
    isLoading,
    showLoading,
    hideLoading,
    resetLoading,
    withLoading,
  };
});
