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
            <button
              v-for="card in column.cards"
              :key="card.id"
              type="button"
              class="board__card-button"
              :class="{ 'board__card-button--selected': isCardOpen && card.id === selectedCardId }"
              @click="openCard(card)"
            >
              <BoardCard :card="card" />
            </button>
            <p v-if="column.cards.length === 0" class="board__empty-cards">尚無卡片</p>
          </div>
          <Button
            v-if="canEdit"
            variant="ghost"
            class="board__add-card-button"
            @click="openAddCard(column)"
          >
            <Plus :size="16" />
            <span>新增卡片</span>
          </Button>
        </section>
      </VueDraggable>
    </template>

    <DialogAddCard
      v-model:open="isAddCardOpen"
      :column="addCardColumn"
      @created="handleCardCreated"
      @stale="loadBoard"
    />
    <DialogCardDetail
      v-model:open="isCardOpen"
      :card="selectedCard?.card ?? null"
      :column-title="selectedCard?.column.title ?? ''"
      :can-edit="canEdit"
      @updated="handleCardUpdated"
      @archived="handleCardArchived"
      @reload="loadBoard"
      @stale="loadBoard"
    />
  </main>
</template>

<script setup lang="ts">
import Logo from '@/components/shared/Logo/Logo.vue';
import BoardCard from '@/components/board/BoardCard.vue';
import DialogAddCard from '@/components/board/DialogAddCard.vue';
import DialogCardDetail from '@/components/board/DialogCardDetail.vue';
import UserMenu from '@/components/account/UserMenu/UserMenu.vue';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/stores/user';
import type {
  ArchiveCardResult,
  BoardCardSnapshot,
  BoardColumnSnapshot,
  CardMutationResult,
} from '@kanban/contracts/board';
import type { ProjectRole } from '@kanban/contracts/project';
import { boardColumnColorMap } from '@/constants/boardColumnColors';
import { getBoardSnapshotApi } from '@/services/board';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { toast } from 'vue-sonner';
import { GripVertical, Plus } from 'lucide-vue-next';
import { VueDraggable } from 'vue-draggable-plus';
const isAddCardOpen = ref<boolean>(false);
const addCardColumn = ref<BoardColumnSnapshot | null>(null);
const userStore = useUserStore();
const route = useRoute();
const boardColumns = ref<BoardColumnSnapshot[]>([]);
// Kept for later phases: card mutations return the new revision, and phase C
// compares it with Socket events to detect missed updates.
const boardRevision = ref<string | null>(null);
const currentUserRole = ref<ProjectRole | null>(null);
// VIEWER can only read the board; the backend also rejects their mutations with 404.
const canEdit = computed<boolean>(
  () => currentUserRole.value === 'OWNER' || currentUserRole.value === 'EDITOR',
);
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
    boardRevision.value = null;
    currentUserRole.value = null;
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  loadError.value = false;
  try {
    const response = await getBoardSnapshotApi(currentProjectId);
    if (requestId !== loadSequence) {
      return;
    }
    boardColumns.value = response.data?.columns ?? [];
    boardRevision.value = response.data?.boardRevision ?? null;
    currentUserRole.value = response.data?.currentUserRole ?? null;
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

const openAddCard = (column: BoardColumnSnapshot) => {
  addCardColumn.value = column;
  isAddCardOpen.value = true;
};

// Q14: apply the returned card directly instead of re-fetching the whole board.
const handleCardCreated = ({ card, boardRevision: nextRevision }: CardMutationResult) => {
  const column = boardColumns.value.find((item) => item.id === card.columnId);
  if (!column) {
    void loadBoard();
    return;
  }
  column.cards.push(card);
  boardRevision.value = nextRevision;
};

const isCardOpen = ref<boolean>(false);
const selectedCardId = ref<string | null>(null);
// Derived from boardColumns, so a reload automatically hands the dialog the latest card.
const selectedCard = computed(() => {
  for (const column of boardColumns.value) {
    const card = column.cards.find((item) => item.id === selectedCardId.value);
    if (card) return { card, column };
  }
  return null;
});

const openCard = (card: BoardCardSnapshot) => {
  selectedCardId.value = card.id;
  isCardOpen.value = true;
};

const handleCardUpdated = ({ card, boardRevision: nextRevision }: CardMutationResult) => {
  const column = boardColumns.value.find((item) => item.id === card.columnId);
  const index = column?.cards.findIndex((item) => item.id === card.id) ?? -1;
  if (!column || index === -1) {
    void loadBoard();
    return;
  }
  column.cards[index] = card;
  boardRevision.value = nextRevision;
};

const handleCardArchived = ({ cardId, columnId, boardRevision: nextRevision }: ArchiveCardResult) => {
  const column = boardColumns.value.find((item) => item.id === columnId);
  if (column) column.cards = column.cards.filter((item) => item.id !== cardId);
  boardRevision.value = nextRevision;
};

// After a reload the opened card may have been archived by someone else.
watch(selectedCard, (value) => {
  if (isCardOpen.value && !value && !isLoading.value) {
    isCardOpen.value = false;
    toast.info('這張卡片已被封存，或已不在看板上。');
  }
});

onMounted(() => {
  void loadBoard();
});

watch(projectId, () => {
  void loadBoard();
});
</script>

<style scoped src="./project-view.css"></style>
