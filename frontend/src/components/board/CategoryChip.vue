<template>
  <span class="category-chip" :class="[colors.backgroundClass, colors.textClass]">
    {{ name }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CardCategoryColorKey } from '@kanban/contracts/board';
import { cardCategoryColorMap } from '@/constants/cardCategoryColors';

const props = defineProps<{
  name: string;
  colorKey: CardCategoryColorKey;
}>();

// Unknown keys (e.g. data written before a palette change) fall back to slate instead of crashing.
const colors = computed(
  () => cardCategoryColorMap[props.colorKey] ?? cardCategoryColorMap.slate,
);
</script>

<style scoped>
@reference '../../styles/index.css';

.category-chip {
  @apply inline-flex w-fit max-w-full items-center truncate rounded-full px-2.5 py-0.5 text-xs font-bold;
}
</style>
