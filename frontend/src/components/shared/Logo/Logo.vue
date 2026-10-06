<template>
  <div :class="cn(compact ? 'flex items-center gap-1.5' : 'flex gap-2 items-end', props.class)">
    <span
      :class="cn('bg-action-primary rounded-lg', compact ? 'h-6.25 w-4.5' : 'w-5.5 h-7 mr-1')"
    ></span>
    <span
      :class="
        cn('bg-flow-active rounded-lg', compact ? 'h-4.25 w-4.5 mr-2' : 'w-5.5 h-5 mr-4 mt-auto')
      "
    ></span>
    <component
      :is="compact ? 'span' : 'h1'"
      :class="cn('font-bold text-2xl', compact ? 'leading-8.5' : 'leading-none')"
      >{{ t('brand.name') }}</component
    >
  </div>
</template>
<script setup lang="ts">
import { cn } from '@/utils/cn';
import { useI18n } from 'vue-i18n';

defineOptions({ name: 'SharedLogo' });
const { t } = useI18n();
const props = defineProps<{
  class?: string;
  compact?: boolean;
}>();
</script>
