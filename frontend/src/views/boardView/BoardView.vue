<template>
  <main class="board">
    <header class="board__header">
      <div class="board__header-content">
        <Logo class="board__logo" />
        <UserMenu v-if="userStore.user" :user="userStore.user" />
      </div>
    </header>

    <div class="board__columns">
      <section v-for="column in boardColumns" :key="column.id" class="board__column">
        <div class="board__column-header">
          <span class="board__column-accent" :class="columnAccentClass[column.colorKey]"></span>
          <span class="board__column-title">{{ column.title }}</span>
        </div>
        <div class="board__cards">
          <BoardCard v-for="card in column.cards" :key="card.id" :card="card" />
        </div>
        <Button variant="ghost" class="board__add-card-button" @click="dialog = true">
          <Plus :size="16" />
          <span>新增卡片</span>
        </Button>
      </section>
    </div>
    <!-- 新增卡片Dialog -->
    <DialogAddCard v-model="dialog" />
  </main>
</template>

<script setup lang="ts">
import Logo from '@/components/common/Logo.vue';
import BoardCard from '@/components/board/BoardCard.vue';
import DialogAddCard from '@/components/board/DialogAddCard.vue';
import UserMenu from '@/components/common/UserMenu.vue';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/stores/user';
import type { BoardColumnData } from '@/types/board';
import { ref } from 'vue';
import { Plus } from 'lucide-vue-next';

const dialog = ref<boolean>(false);
const userStore = useUserStore();
const columnAccentClass = {
  ready: 'board__column-accent--ready',
  active: 'board__column-accent--active',
  review: 'board__column-accent--review',
  done: 'board__column-accent--done',
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

<style scoped src="./board-view.css"></style>
