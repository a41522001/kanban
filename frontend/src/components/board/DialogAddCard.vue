<template>
  <Dialog v-model:open="dialog">
    <DialogContent
      :show-close-button="false"
      class="max-h-[calc(100dvh-2rem)] max-w-150 overflow-y-auto p-6 lg:p-8"
    >
      <DialogHeader>
        <DialogTitle class="text-xl text-content-primary">新增卡片</DialogTitle>
        <DialogDescription class="sr-only">新增一張看板卡片。</DialogDescription>
      </DialogHeader>

      <DialogClose
        aria-label="關閉新增卡片視窗"
        class="absolute top-6 right-6 cursor-pointer rounded-control p-2 text-content-primary transition-colors hover:bg-board-page focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action-primary/20 lg:top-8 lg:right-8"
      >
        <X :size="18" aria-hidden="true" />
      </DialogClose>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const dialog = defineModel<boolean>({ required: true });
</script>
