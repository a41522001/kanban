<template>
  <main class="board">
    <header class="board__header">
      <div class="board__header-content">
        <Logo class="board__logo" />
        <UserMenu v-if="userStore.user" :user="userStore.user" />
      </div>
    </header>

    <!-- Board spec Q11: saving still works over HTTP; only live updates are paused. -->
    <p v-if="!isConnected && !isLoading" class="board__sync-banner" role="status">
      <WifiOff :size="16" aria-hidden="true" />
      即時同步已中斷，正在重新連線…
    </p>

    <div v-if="isLoading" class="board__columns" aria-busy="true" aria-label="載入看板欄位中">
      <div v-for="index in 4" :key="index" class="board__column board__column--skeleton" />
    </div>

    <div v-else-if="loadError" class="board__state" role="alert">
      <p>無法載入看板欄位。</p>
      <Button variant="outline" @click="reloadBoard">重新載入</Button>
    </div>

    <div v-else-if="boardColumns.length === 0" class="board__state" role="status">
      目前沒有可顯示的欄位。
    </div>

    <template v-else>
      <!-- Board spec §8.3 (Q16): columns are reordered on the board itself, like Trello. -->
      <VueDraggable
        v-model="boardColumns"
        class="board__columns"
        tag="div"
        :animation="columnDragAnimation"
        :delay="150"
        draggable=".board__column"
        direction="horizontal"
        handle=".board__column-handle"
        :delay-on-touch-only="true"
        :disabled="!canEdit"
        chosen-class="board__column--chosen"
        ghost-class="board__column--ghost"
        drag-class="board__column--dragging"
        @start="handleColumnDragStart"
        @end="handleColumnDragEnd"
      >
        <section
          v-for="column in boardColumns"
          :key="column.id"
          class="board__column"
          :data-board-column-id="column.id"
        >
          <div class="board__column-header">
            <button
              v-if="canEdit"
              type="button"
              class="board__column-handle"
              :aria-label="`拖曳欄位「${column.title}」`"
            >
              <GripVertical :size="18" aria-hidden="true" />
            </button>
            <span
              class="board__column-accent"
              :class="boardColumnColorMap[column.colorKey].accentClass"
            ></span>
            <span class="board__column-title">{{ column.title }}</span>
          </div>
          <div class="board__cards-area">
            <!-- Board spec §6: only the handle drags; mobile needs a 220ms long press. -->
            <VueDraggable
              v-model="column.cards"
              class="board__cards"
              :class="{ 'board__cards--drop-target': dragOverColumnId === column.id }"
              :data-column-id="column.id"
              tag="div"
              group="board-cards"
              draggable=".board__card"
              handle=".board__card-handle"
              :delay="220"
              :delay-on-touch-only="true"
              :animation="dragAnimation"
              :disabled="!canEdit"
              chosen-class="board__card--chosen"
              ghost-class="board__card--ghost"
              drag-class="board__card--dragging"
              @start="handleCardDragStart"
              @move="handleCardDragMove"
              @end="handleCardDragEnd"
            >
              <div
                v-for="card in column.cards"
                :key="card.id"
                class="board__card"
                :class="{ 'board__card--editable': canEdit }"
                :data-card-id="card.id"
              >
                <button
                  type="button"
                  class="board__card-button"
                  :class="{
                    'board__card-button--selected': isCardOpen && card.id === selectedCardId,
                  }"
                  @click="openCard(card)"
                >
                  <BoardCard :card="card" :category="findCategory(card.categoryId)" />
                </button>
                <button
                  v-if="canEdit"
                  type="button"
                  class="board__card-handle"
                  :aria-label="`拖曳卡片「${card.title}」`"
                >
                  <GripVertical :size="18" aria-hidden="true" />
                </button>
              </div>
            </VueDraggable>
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
      :project-id="projectId"
      :categories="categories"
      @category-created="handleCategoryCreated"
      @created="handleCardCreated"
      @stale="reloadBoard"
    />
    <DialogCardDetail
      v-model:open="isCardOpen"
      :card="selectedCard?.card ?? null"
      :column-title="selectedCard?.column.title ?? ''"
      :can-edit="canEdit"
      :project-id="projectId"
      :categories="categories"
      :columns="boardColumns"
      @category-created="handleCategoryCreated"
      @move="handleMoveFromDialog"
      @updated="handleCardUpdated"
      @archived="handleCardArchived"
      @reload="reloadBoard"
      @stale="reloadBoard"
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
  AddCategoryResult,
  ArchiveCardResult,
  BoardCardSnapshot,
  BoardColumnSnapshot,
  CardCategorySnapshot,
  CardMutationResult,
} from '@kanban/contracts/board';
import type { ProjectRole } from '@kanban/contracts/project';
import { boardColumnColorMap } from '@/constants/boardColumnColors';
import { getBoardSnapshotApi, moveCardApi, moveColumnApi } from '@/services/board';
import { getApiErrorResponse } from '@/services/http';
import { ApiCode } from '@kanban/contracts/api';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { toast } from 'vue-sonner';
import { GripVertical, Plus, WifiOff } from 'lucide-vue-next';
import { VueDraggable, type MoveEvent, type SortableEvent } from 'vue-draggable-plus';
import { findCardLocation, getAfterCardId, moveCardToColumnEnd } from './cardMove';
import { getAfterColumnId } from './columnMove';
import { applyBoardChange, createBoardSync, type BoardChange } from './boardSync';
import {
  emitProjectInto,
  emitProjectLeave,
  isConnected,
  offBoardEvents,
  offReconnected,
  onBoardEvents,
  onReconnected,
  type BoardEventHandlers,
} from '@/services/socket';
const isAddCardOpen = ref<boolean>(false);
const addCardColumn = ref<BoardColumnSnapshot | null>(null);
const userStore = useUserStore();
const route = useRoute();
const boardColumns = ref<BoardColumnSnapshot[]>([]);
// Revision of what is on screen; every change is checked against it (Board spec §7.3).
const boardRevision = ref<string | null>(null);
const categories = ref<CardCategorySnapshot[]>([]);
// Cards only carry categoryId; look the category up once per render instead of scanning the array.
const categoryById = computed(
  () => new Map(categories.value.map((category) => [category.id, category])),
);
const findCategory = (categoryId: string | null) =>
  categoryId ? (categoryById.value.get(categoryId) ?? null) : null;

// A reused category returns the current revision without changing anything, so it must not
// advance boardRevision; only a category we do not have yet goes through the sync.
const handleCategoryCreated = (result: AddCategoryResult) => {
  if (categoryById.value.has(result.category.id)) return;
  receiveChange({ kind: 'categoryCreated', result });
};
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

/**
 * Loads the whole board. Changes received meanwhile wait in the sync queue and are replayed
 * against the new snapshot (Board spec Q5). `silent` keeps the current board on screen, so a
 * background reload (missed change, reconnect) does not reset scrolling or close dialogs.
 */
const loadBoard = async ({ silent = false }: { silent?: boolean } = {}) => {
  const requestId = ++loadSequence;
  const currentProjectId = projectId.value;
  sync.pause('loading');

  if (!currentProjectId) {
    boardColumns.value = [];
    boardRevision.value = null;
    currentUserRole.value = null;
    categories.value = [];
    isLoading.value = false;
    sync.clear();
    sync.resume('loading');
    return;
  }

  if (!silent || boardRevision.value === null) isLoading.value = true;
  loadError.value = false;
  try {
    const response = await getBoardSnapshotApi(currentProjectId);
    if (requestId !== loadSequence) {
      return;
    }
    boardColumns.value = response.data?.columns ?? [];
    boardRevision.value = response.data?.boardRevision ?? null;
    currentUserRole.value = response.data?.currentUserRole ?? null;
    categories.value = response.data?.categories ?? [];
  } catch {
    if (requestId === loadSequence) {
      loadError.value = true;
      // Replaying against a board that failed to load would only trigger more reloads.
      sync.clear();
    }
  } finally {
    // Only the latest request resumes; an older one was superseded and still counts as loading.
    if (requestId === loadSequence) {
      isLoading.value = false;
      sync.resume('loading');
    }
  }
};

const reloadBoard = () => {
  void loadBoard();
};

const sync = createBoardSync({
  getProjectId: () => projectId.value,
  getRevision: () => boardRevision.value,
  setRevision: (revision) => {
    boardRevision.value = revision;
  },
  apply: (change) =>
    applyBoardChange({ columns: boardColumns.value, categories: categories.value }, change),
  reload: () => {
    void loadBoard({ silent: true });
  },
});

/**
 * Our own HTTP results go through the same path as Socket events: whichever arrives first is
 * applied and the other is dropped as stale (Board spec Q4).
 */
const receiveChange = (change: BoardChange) => {
  sync.receive(projectId.value, change);
};

const boardEventHandlers: BoardEventHandlers = {
  'board:columnCreated': ({ projectId: eventProjectId, ...result }) =>
    sync.receive(eventProjectId, { kind: 'columnCreated', result }),
  'board:cardCreated': ({ projectId: eventProjectId, ...result }) =>
    sync.receive(eventProjectId, { kind: 'cardCreated', result }),
  'board:cardUpdated': ({ projectId: eventProjectId, ...result }) =>
    sync.receive(eventProjectId, { kind: 'cardUpdated', result }),
  'board:cardMoved': ({ projectId: eventProjectId, ...result }) =>
    sync.receive(eventProjectId, { kind: 'cardMoved', result }),
  'board:cardArchived': ({ projectId: eventProjectId, ...result }) =>
    sync.receive(eventProjectId, { kind: 'cardArchived', result }),
  'board:categoryCreated': ({ projectId: eventProjectId, ...result }) =>
    sync.receive(eventProjectId, { kind: 'categoryCreated', result }),
  'board:columnMoved': ({ projectId: eventProjectId, ...result }) =>
    sync.receive(eventProjectId, { kind: 'columnMoved', result }),
};

const openAddCard = (column: BoardColumnSnapshot) => {
  addCardColumn.value = column;
  isAddCardOpen.value = true;
};

// Q14: apply the returned card directly instead of re-fetching the whole board.
const handleCardCreated = (result: CardMutationResult) => {
  receiveChange({ kind: 'cardCreated', result });
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

const handleCardUpdated = (result: CardMutationResult) => {
  receiveChange({ kind: 'cardUpdated', result });
};

const handleCardArchived = (result: ArchiveCardResult) => {
  receiveChange({ kind: 'cardArchived', result });
};

// ---- Moving cards (Board spec B-2, §6) ----
// The board is already updated locally (by the drag library or the dialog menu); this only
// saves it. Any failure reloads the whole board instead of trying to roll back (spec §6).
const saveCardMove = async (cardId: string) => {
  const location = findCardLocation(boardColumns.value, cardId);
  if (!location) return;
  const { column, index } = location;
  const card = column.cards[index];
  // A card dragged across columns still carries its old columnId until the response arrives.
  if (card && card.columnId !== column.id) column.cards[index] = { ...card, columnId: column.id };

  try {
    const response = await moveCardApi({
      cardId,
      toColumnId: column.id,
      afterCardId: getAfterCardId(column, index),
    });
    if (!response.data) return;
    // The card is already in place locally; the result fixes its position and revision.
    receiveChange({ kind: 'cardMoved', result: response.data });
  } catch (error) {
    const apiError = getApiErrorResponse(error);
    toast.error(
      apiError?.code === ApiCode.CardMoveConflict
        ? '看板已被其他人變更，已重新載入。'
        : '移動卡片失敗，已重新載入看板。',
    );
    void loadBoard({ silent: true });
  }
};

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
const dragAnimation = prefersReducedMotion ? 0 : 200;
const draggingCardId = ref<string | null>(null);
const dragOverColumnId = ref<string | null>(null);

const handleCardDragStart = (event: SortableEvent) => {
  draggingCardId.value = event.item.dataset.cardId ?? null;
  // Changing column.cards mid-drag would confuse the drag library (Board spec Q6).
  sync.pause('dragging');
};

const handleCardDragMove = (event: MoveEvent) => {
  dragOverColumnId.value = event.to.dataset.columnId ?? null;
};

// By the time `end` fires, the library has already updated column.cards.
const handleCardDragEnd = (event: SortableEvent) => {
  const cardId = draggingCardId.value;
  draggingCardId.value = null;
  dragOverColumnId.value = null;
  if (!cardId || (event.from === event.to && event.oldIndex === event.newIndex)) {
    sync.resume('dragging');
    return;
  }
  // Queued changes are replayed only after our own move has been saved (or reloaded).
  void saveCardMove(cardId).finally(() => sync.resume('dragging'));
};

// ---- Moving columns (Board spec D-2, §8.3) ----
// Same flow as cards: the drag library has already reordered boardColumns; this saves it, and
// any failure reloads the board instead of rolling back.
const saveColumnMove = async (columnId: string) => {
  const afterColumnId = getAfterColumnId(boardColumns.value, columnId);
  if (afterColumnId === undefined) return;

  try {
    const response = await moveColumnApi({ columnId, afterColumnId });
    if (!response.data) return;
    // The result carries every column's position (renumbering included).
    receiveChange({ kind: 'columnMoved', result: response.data });
  } catch (error) {
    const apiError = getApiErrorResponse(error);
    toast.error(
      apiError?.code === ApiCode.ColumnMoveConflict
        ? '看板已被其他人變更，已重新載入。'
        : '移動欄位失敗，已重新載入看板。',
    );
    void loadBoard({ silent: true });
  }
};

const columnDragAnimation = prefersReducedMotion ? 0 : 250;
let draggingColumnId: string | null = null;

const handleColumnDragStart = (event: SortableEvent) => {
  draggingColumnId = event.item.dataset.boardColumnId ?? null;
  sync.pause('dragging');
};

const handleColumnDragEnd = (event: SortableEvent) => {
  const columnId = draggingColumnId;
  draggingColumnId = null;
  if (!columnId || event.oldIndex === event.newIndex) {
    sync.resume('dragging');
    return;
  }
  void saveColumnMove(columnId).finally(() => sync.resume('dragging'));
};

const handleMoveFromDialog = (toColumnId: string) => {
  if (!selectedCardId.value) return;
  const cardId = selectedCardId.value;
  if (!moveCardToColumnEnd(boardColumns.value, cardId, toColumnId)) return;
  void saveCardMove(cardId);
};

// After a reload the opened card may have been archived by someone else.
watch(selectedCard, (value) => {
  if (isCardOpen.value && !value && !isLoading.value) {
    isCardOpen.value = false;
    toast.info('這張卡片已被封存，或已不在看板上。');
  }
});

// Board events sent while disconnected are lost, so reload after reconnecting (Board spec §7.4).
const handleReconnected = () => {
  void loadBoard({ silent: true });
};

onMounted(() => {
  onReconnected(handleReconnected);
  onBoardEvents(boardEventHandlers);
  void loadBoard();
});

watch(projectId, () => {
  void loadBoard();
});

// The room this view joined. Kept separately because on unmount the route may already point elsewhere.
let joinedProjectId: string | null = null;

// The route can switch projects without remounting, so follow projectId rather than mount/unmount only.
watch(
  projectId,
  (nextProjectId) => {
    if (joinedProjectId === nextProjectId) return;
    if (joinedProjectId) emitProjectLeave(joinedProjectId);
    joinedProjectId = nextProjectId || null;
    if (joinedProjectId) emitProjectInto(joinedProjectId);
  },
  { immediate: true },
);

onUnmounted(() => {
  offReconnected(handleReconnected);
  offBoardEvents(boardEventHandlers);
  if (joinedProjectId) emitProjectLeave(joinedProjectId);
  joinedProjectId = null;
});
</script>

<style scoped src="./project-view.css"></style>
