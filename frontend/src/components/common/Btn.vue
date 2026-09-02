<template>
  <button
    :disabled="disabled"
    :class="
      cn(
        'inline-flex cursor-pointer items-center justify-center rounded-control bg-action-primary px-5 py-3 font-bold text-content-on-dark transition-[background-color,opacity] duration-150 hover:bg-action-primary-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-action-primary',
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
  disabled?: boolean;
}>();
</script>
