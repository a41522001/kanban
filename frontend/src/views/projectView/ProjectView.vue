<template>
  <main class="board">
    <header class="board__header">
      <div class="board__header-content">
        <Logo class="board__logo" />
        <UserMenu v-if="userStore.user" :user="userStore.user" />
      </div>
    </header>

    <div v-if="isLoading" class="board__columns" aria-busy="true" aria-label="載入看板欄位中">
      <div v-for="index in 4" :key="index" class="board__column board__column--skeleton" />
    </div>

    <div v-else-if="loadError" class="board__state" role="alert">
      <p>無法載入看板欄位。</p>
      <Button variant="outline" @click="loadBoard">重新載入</Button>
    </div>

    <div v-else-if="boardColumns.length === 0" class="board__state" role="status">
      目前沒有可顯示的欄位。
    </div>

    <template v-else>
      <VueDraggable
        v-model="boardColumns"
        class="board__columns"
        tag="div"
        :animation="250"
        :delay="150"
        draggable=".board__column"
        direction="horizontal"
        handle=".board__column-handle"
        :delay-on-touch-only="true"
        chosen-class="board__column--chosen"
        ghost-class="board__column--ghost"
        drag-class="board__column--dragging"
      >
        <section v-for="column in boardColumns" :key="column.id" class="board__column">
          <div class="board__column-header">
            <button type="button" class="board__column-handle" aria-label="拖曳欄位">
              <GripVertical :size="18" aria-hidden="true" />
            </button>
            <span
              class="board__column-accent"
              :class="boardColumnColorMap[column.colorKey].accentClass"
            ></span>
            <span class="board__column-title">{{ column.title }}</span>
          </div>
          <div class="board__cards">
            <BoardCard v-for="card in column.cards" :key="card.id" :card="card" />
            <p v-if="column.cards.length === 0" class="board__empty-cards">尚無卡片</p>
          </div>
          <Button variant="ghost" class="board__add-card-button" @click="dialog = true">
            <Plus :size="16" />
            <span>新增卡片</span>
          </Button>
        </section>
      </VueDraggable>
    </template>

    <!-- 新增卡片Dialog -->
    <DialogAddCard v-model="dialog" />
  </main>
</template>

<script setup lang="ts">
import Logo from '@/components/shared/Logo/Logo.vue';
import BoardCard from '@/components/board/BoardCard.vue';
import DialogAddCard from '@/components/board/DialogAddCard.vue';
import UserMenu from '@/components/account/UserMenu/UserMenu.vue';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/stores/user';
import type { BoardColumnData } from '@/types/board';
import { boardColumnColorMap } from '@/constants/boardColumnColors';
import { getBoardColumnsApi } from '@/services/board';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { GripVertical, Plus } from 'lucide-vue-next';
import { VueDraggable } from 'vue-draggable-plus';
const dialog = ref<boolean>(false);
const userStore = useUserStore();
const route = useRoute();
const boardColumns = ref<BoardColumnData[]>([]);
const isLoading = ref<boolean>(true);
const loadError = ref<boolean>(false);
let loadSequence = 0;

const projectId = computed<string>(() => {
  const value = route.params.projectId;
  return typeof value === 'string' ? value : '';
});

const loadBoard = async () => {
  const requestId = ++loadSequence;
  const currentProjectId = projectId.value;

  if (!currentProjectId) {
    boardColumns.value = [];
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  loadError.value = false;
  try {
    const response = await getBoardColumnsApi(currentProjectId);
    if (requestId !== loadSequence) {
      return;
    }
    boardColumns.value = (response.data ?? []).map((column) => ({
      ...column,
      cards: [],
    }));
  } catch {
    if (requestId === loadSequence) {
      loadError.value = true;
    }
  } finally {
    if (requestId === loadSequence) {
      isLoading.value = false;
    }
  }
};

onMounted(() => {
  void loadBoard();
});

watch(projectId, () => {
  void loadBoard();
});
</script>

<style scoped src="./project-view.css"></style>
