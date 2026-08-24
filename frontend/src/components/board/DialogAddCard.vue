<template>
  <Dialog
    v-model="dialog"
    class="w-[calc(100vw-2rem)] max-w-150 max-h-[calc(100dvh-2rem)] overflow-y-auto"
  >
    <div class="flex flex-col p-6 lg:p-8">
      <div class="flex justify-between items-center w-full max-w-full">
        <div class="text-content-primary font-bold text-xl">新增卡片</div>
        <Btn class="bg-auth-page p-2 hover:bg-board-page" @click="dialog = false">
          <X class="text-sm text-black" />
        </Btn>
      </div>
    </div>
    <!-- <div class="w-125 p-6">
      <h2 class="text-xl font-bold">Dialog Title</h2>

      <p class="mt-4 text-gray-600">這裡完全由父層決定。</p>

      <div class="mt-6 flex justify-end">
        <button class="rounded-lg bg-gray-200 px-4 py-2" @click="dialog = false">關閉</button>
      </div>
    </div> -->
  </Dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Dialog from '@/components/common/Dialog.vue';
import Btn from '@/components/common/Btn.vue';
import { X } from 'lucide-vue-next';
const dialog = defineModel<boolean>({ required: true });
</script>
