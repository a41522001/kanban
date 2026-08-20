<template>
  <main class="min-h-full h-full">
    <header class="bg-content-primary px-7 py-4">
      <div class="flex justify-between">
        <Logo class="text-content-on-dark" />
        <Avatar name="Jeffery" />
      </div>
    </header>

    <div class="flex gap-4 overflow-x-auto overscroll-x-contain p-4">
      <section
        v-for="column in boardColumns"
        :key="column.id"
        class="w-72 shrink-0 bg-auth-page border-border-strong border rounded-xl p-4"
      >
        <div class="flex gap-3 mb-3">
          <span class="w-2 h-6 rounded-2xl" :class="columnAccentClass[column.colorKey]"></span>
          <span class="text-content-primary font-bold">{{ column.title }}</span>
        </div>
        <div class="flex flex-col gap-3">
          <BoardCard v-for="card in column.cards" :key="card.id" :card="card" />
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import Avatar from '@/components/common/Avatar.vue';
import Logo from '@/components/common/Logo.vue';
import BoardCard from '@/components/board/BoardCard.vue';
import type { BoardColumnData } from '@/types/board';
import { ref } from 'vue';

const columnAccentClass = {
  ready: 'bg-flow-ready',
  active: 'bg-flow-active',
  review: 'bg-flow-review',
  done: 'bg-flow-done',
} as const;

const boardColumns = ref<BoardColumnData[]>([
  {
    id: 'ready',
    boardId: 'board-1',
    title: '準備開始',
    position: 1,
    colorKey: 'ready',
    version: 1,
    cards: [
      {
        id: 'card-1',
        columnId: 'ready',
        title: '規劃工作區首頁資訊架構',
        category: {
          name: '企劃',
          colorKey: 'coral',
        },
        labels: ['UX', 'Frontend'],
        position: 1,
        version: 1,
      },
      {
        id: 'card-2',
        columnId: 'ready',
        title: '建立新增看板 API',
        category: {
          name: 'API',
          colorKey: 'mint',
        },
        labels: ['Board', 'Backend'],
        position: 2,
        version: 1,
      },
      {
        id: 'card-3',
        columnId: 'ready',
        title: '補上卡片到期日欄位',
        category: {
          name: '資料庫',
          colorKey: 'amber',
        },
        labels: ['Card', 'Database'],
        position: 3,
        version: 1,
      },
    ],
  },
  {
    id: 'active',
    boardId: 'board-1',
    title: '正在進行',
    position: 2,
    colorKey: 'active',
    version: 1,
    cards: [
      {
        id: 'card-4',
        columnId: 'active',
        title: '建立使用者註冊 API',
        category: {
          name: '後端',
          colorKey: 'mint',
        },
        labels: ['Auth', 'Backend'],
        position: 1,
        version: 2,
      },
      {
        id: 'card-5',
        columnId: 'active',
        title: '串接登入表單驗證',
        category: {
          name: '前端',
          colorKey: 'lavender',
        },
        labels: ['Auth', 'Frontend'],
        position: 2,
        version: 1,
      },
    ],
  },
  {
    id: 'review',
    boardId: 'board-1',
    title: '等待檢視',
    position: 3,
    colorKey: 'review',
    version: 1,
    cards: [
      {
        id: 'card-6',
        columnId: 'review',
        title: '實作 Board WebSocket Room',
        category: {
          name: '即時同步',
          colorKey: 'blue',
        },
        labels: ['WebSocket', 'Backend'],
        position: 1,
        version: 3,
      },
      {
        id: 'card-7',
        columnId: 'review',
        title: '調整手機版看板橫向滑動',
        category: {
          name: 'RWD',
          colorKey: 'slate',
        },
        labels: ['RWD', 'Frontend'],
        position: 2,
        version: 1,
      },
    ],
  },
  {
    id: 'done',
    boardId: 'board-1',
    title: '已完成',
    position: 4,
    colorKey: 'done',
    version: 1,
    cards: [
      {
        id: 'card-8',
        columnId: 'done',
        title: '建立共用 Alert 元件',
        category: {
          name: 'UI 元件',
          colorKey: 'coral',
        },
        labels: ['UI', 'Frontend'],
        position: 1,
        version: 2,
      },
      {
        id: 'card-9',
        columnId: 'done',
        title: '建立全域 Loading 元件',
        category: {
          name: '狀態管理',
          colorKey: 'lavender',
        },
        labels: ['UI', 'Pinia'],
        position: 2,
        version: 1,
      },
    ],
  },
]);
</script>
