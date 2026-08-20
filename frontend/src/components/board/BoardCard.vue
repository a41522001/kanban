<template>
  <div class="p-4 bg-white rounded-xl flex flex-col gap-3">
    <Clip
      :content="card.category.name"
      :background-class="cardCategoryColorMap[card.category.colorKey].backgroundClass"
      :text-class="cardCategoryColorMap[card.category.colorKey].textClass"
    />
    <p class="font-bold text-content-primary">{{ card.title }}</p>
    <span class="text-content-secondary text-sm">{{ card.labels.join(', ') }}</span>
  </div>
</template>
<script setup lang="ts">
import Clip from '@/components/common/Clip.vue';
import { cardCategoryColorMap } from '@/constants/cardCategoryColors';
import type { BoardCardData } from '@/types/board';

defineProps<{
  card: BoardCardData;
}>();
</script>
