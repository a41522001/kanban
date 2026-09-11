<template>
  <Teleport to="body">
    <Transition name="loading">
      <div
        v-if="isLoading"
        role="status"
        aria-live="polite"
        aria-busy="true"
        :aria-label="content ?? '載入中'"
        class="fixed inset-0 z-60 grid place-items-center bg-content-primary/35 p-4 backdrop-blur-xs"
      >
        <div
          class="flex flex-col items-center rounded-surface bg-surface shadow-card"
          :class="content ? 'min-w-40 px-8 py-6' : 'p-5'"
        >
          <span class="loading-spinner" aria-hidden="true"></span>
          <p
            v-if="content"
            class="mt-4 max-w-64 text-center text-sm font-bold text-content-primary"
          >
            {{ content }}
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useLoadingStore } from '@/stores/loading';

defineOptions({ name: 'AppLoading' });

const loadingStore = useLoadingStore();
const { content, isLoading } = storeToRefs(loadingStore);
let previousBodyOverflow = '';

const restorePageScroll = () => {
  document.body.style.overflow = previousBodyOverflow;
};

watch(
  isLoading,
  (isActive) => {
    if (!isActive) {
      restorePageScroll();
      return;
    }

    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (isLoading.value) {
    restorePageScroll();
  }
});
</script>

<style scoped>
.loading-spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 0.25rem solid var(--color-action-primary-soft);
  border-top-color: var(--color-action-primary);
  border-right-color: var(--color-flow-active-strong);
  border-radius: 9999px;
  animation: loading-spin 700ms linear infinite;
}

.loading-enter-active,
.loading-leave-active {
  transition-property: opacity;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}

.loading-enter-from,
.loading-leave-to {
  opacity: 0;
}

@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    animation: none;
  }

  .loading-enter-active,
  .loading-leave-active {
    transition-duration: 0ms;
  }
}
</style>
