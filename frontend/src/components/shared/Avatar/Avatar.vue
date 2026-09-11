<template>
  <span
    class="flex size-8 items-center justify-center rounded-full bg-flow-active text-content-primary"
  >
    {{ shortname }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

defineOptions({ name: 'SharedAvatar' });

interface Props {
  name: string;
}
const props = defineProps<Props>();
const shortname = computed(() => props.name.trim().charAt(0).toUpperCase() || '?');
</script>
