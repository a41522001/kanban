<template>
  <dialog
    ref="dialogRef"
    class="m-auto rounded-xl bg-white p-0 shadow-xl backdrop:bg-black/50"
    @click="handleBackdropClick"
    @cancel="handleCancel"
    @close="handleClose"
  >
    <slot />
  </dialog>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

const model = defineModel<boolean>({
  required: true,
});

const dialogRef = ref<HTMLDialogElement | null>(null);

/**
 * 將 Vue 的 model 狀態同步到原生 dialog
 */
const syncDialog = (isOpen: boolean) => {
  const dialogEl = dialogRef.value;

  if (!dialogEl) return;

  if (isOpen && !dialogEl.open) {
    dialogEl.showModal();
    return;
  }

  if (!isOpen && dialogEl.open) {
    dialogEl.close();
  }
};

/**
 * 父層 v-model 發生變化
 */
watch(model, (value) => {
  syncDialog(value);
});

/**
 * 處理父層初始化就是 true 的情況
 */
onMounted(() => {
  syncDialog(model.value);
});

/**
 * 關閉 Dialog
 */
const close = () => {
  model.value = false;
};

/**
 * 點擊 backdrop 關閉
 *
 * event.target === dialogRef.value
 * 代表點到的是 dialog 本身，而不是 slot 裡面的內容
 */
const handleBackdropClick = (event: MouseEvent) => {
  if (event.target === dialogRef.value) {
    close();
  }
};

/**
 * 按下 ESC 時，原生 dialog 會觸發 cancel
 */
const handleCancel = (event: Event) => {
  event.preventDefault();

  close();
};

/**
 * 如果有人直接呼叫：
 *
 * dialog.close()
 *
 * 也要把 Vue model 同步回 false
 */
const handleClose = () => {
  if (model.value) {
    model.value = false;
  }
};
</script>
