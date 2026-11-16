<template>
  <div class="board-card">
    <CategoryChip
      v-if="category"
      :name="category.name"
      :color-key="category.colorKey"
      data-testid="card-category"
    />
    <p class="board-card__title">{{ card.title }}</p>
  </div>
</template>

<script setup lang="ts">
import type { BoardCardSnapshot, CardCategorySnapshot } from '@kanban/contracts/board';
import CategoryChip from './CategoryChip.vue';

// The parent resolves card.categoryId against BoardSnapshot.categories (Board spec Q10).
defineProps<{
  card: BoardCardSnapshot;
  category?: CardCategorySnapshot | null;
}>();
</script>

<style scoped>
@reference '../../styles/index.css';

.board-card {
  @apply flex flex-col gap-2 rounded-xl bg-white p-4;
}

.board-card__title {
  @apply font-bold text-content-primary;
}
</style>
