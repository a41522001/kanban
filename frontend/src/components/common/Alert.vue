<template>
  <Teleport to="body">
    <Transition name="alert">
      <div
        v-if="openFlag"
        class="alert-overlay fixed inset-0 z-50 grid place-items-center bg-content-primary/45 p-4 backdrop-blur-xs"
        @keydown="handleKeydown"
      >
        <section
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="alert-content"
          :aria-busy="isProcessing"
          class="alert-panel w-full max-w-sm rounded-surface bg-surface p-6 shadow-card"
        >
          <div class="flex items-start gap-4">
            <span
              class="grid size-10 shrink-0 place-items-center rounded-full bg-action-primary-soft text-action-primary-hover"
              aria-hidden="true"
            >
              <CircleAlert :size="22" :stroke-width="2" />
            </span>

            <div class="min-w-0 pt-2">
              <p
                id="alert-content"
                class="whitespace-pre-line text-sm font-bold leading-6 text-content-primary"
              >
                {{ content }}
              </p>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              v-if="hasCancel"
              ref="cancelButtonRef"
              type="button"
              class="min-w-20 cursor-pointer rounded-control border border-border-strong bg-surface px-4 py-2.5 text-sm font-bold text-content-primary transition-colors duration-150 hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-primary disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isProcessing"
              @click="handleCancel"
            >
              {{ cancelText }}
            </button>
            <button
              ref="confirmButtonRef"
              type="button"
              class="min-w-20 cursor-pointer rounded-control bg-action-primary px-4 py-2.5 text-sm font-bold text-content-on-dark transition-[background-color,scale] duration-150 hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-primary active:scale-96 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isProcessing"
              @click="handleConfirm"
            >
              {{ confirmText }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { CircleAlert } from 'lucide-vue-next';
import { useAlertStore } from '@/stores/alert';

defineOptions({ name: 'AppAlert' });

const alertStore = useAlertStore();
const { cancelText, confirmText, content, hasCancel, isProcessing, openFlag } =
  storeToRefs(alertStore);
const { handleCancel, handleConfirm } = alertStore;

const confirmButtonRef = ref<HTMLButtonElement | null>(null);
const cancelButtonRef = ref<HTMLButtonElement | null>(null);
let previouslyFocusedElement: HTMLElement | null = null;
let previousBodyOverflow = '';

const restorePageState = () => {
  document.body.style.overflow = previousBodyOverflow;
  previouslyFocusedElement?.focus();
  previouslyFocusedElement = null;
};

watch(openFlag, async (isOpen) => {
  if (!isOpen) {
    restorePageState();
    return;
  }

  previouslyFocusedElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  await nextTick();
  confirmButtonRef.value?.focus();
});

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && hasCancel.value && !isProcessing.value) {
    event.preventDefault();
    void handleCancel();
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const focusableElements = [cancelButtonRef.value, confirmButtonRef.value].filter(
    (element): element is HTMLButtonElement => element !== null && !element.disabled,
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (!firstElement || !lastElement) {
    return;
  }

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
};

onBeforeUnmount(() => {
  if (openFlag.value) {
    restorePageState();
  }
});
</script>

<style scoped>
.alert-enter-active,
.alert-leave-active {
  transition-property: opacity;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}

.alert-enter-active .alert-panel,
.alert-leave-active .alert-panel {
  transition-property: opacity, transform;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}

.alert-enter-from,
.alert-leave-to,
.alert-enter-from .alert-panel,
.alert-leave-to .alert-panel {
  opacity: 0;
}

.alert-enter-from .alert-panel {
  transform: translateY(0.5rem) scale(0.98);
}

.alert-leave-to .alert-panel {
  transform: translateY(0.25rem) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .alert-enter-active,
  .alert-leave-active,
  .alert-enter-active .alert-panel,
  .alert-leave-active .alert-panel {
    transition-duration: 0ms;
  }
}
</style>
