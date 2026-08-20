<template>
  <span
    class="flex items-center justify-center w-8 h-8 rounded-full bg-flow-active cursor-pointer hover:bg-flow-active-strong hover:text-auth-page transition duration-300 ease-in-out"
  >
    {{ shortname }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  name: string;
}
const props = defineProps<Props>();
const shortname = computed(() => props.name[0]);
</script>
