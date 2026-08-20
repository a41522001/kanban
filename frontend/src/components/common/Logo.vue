<template>
  <div :class="cn('flex gap-2', props.class)">
    <span class="bg-action-primary w-5.5 h-7 rounded-lg mr-1"></span>
    <span class="bg-flow-active w-5.5 h-5 rounded-lg mr-4 mt-auto"></span>
    <h1 class="font-bold text-2xl leading-none">{{ t('brand.name') }}</h1>
  </div>
</template>
<script setup lang="ts">
import { cn } from '@/utils/cn';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const props = defineProps<{
  class?: string;
}>();
</script>
