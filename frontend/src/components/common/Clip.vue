<template>
  <span
    :class="
      cn(
        'me-auto rounded-2xl px-4 py-1 text-xs font-medium',
        props.backgroundClass,
        props.textClass,
        props.class,
      )
    "
  >
    {{ props.content }}
  </span>
</template>

<script setup lang="ts">
import { cn } from '@/utils/cn';

const props = defineProps<{
  class?: string;
  content: string;
  backgroundClass: string;
  textClass: string;
}>();
</script>
