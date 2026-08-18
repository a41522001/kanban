<template>
  <button
    :class="
      cn(
        'inline-flex items-center justify-center rounded-control bg-action-primary px-5 py-3 font-bold text-content-on-dark hover:bg-action-primary-hover cursor-pointer',
        props.class,
      )
    "
  >
    <slot />
  </button>
</template>
<script setup lang="ts">
import { cn } from '@/utils/cn';

const props = defineProps<{
  class?: string;
}>();
</script>
