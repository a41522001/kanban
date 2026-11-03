<template>
  <!-- Category and labels return once they are persisted (Board spec A+). -->
  <div class="p-4 bg-white rounded-xl flex flex-col gap-3">
    <p class="font-bold text-content-primary">{{ card.title }}</p>
  </div>
</template>
<script setup lang="ts">
import type { BoardCardSnapshot } from '@kanban/contracts/board';

defineProps<{
  card: BoardCardSnapshot;
}>();
</script>
