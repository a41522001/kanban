<template>
  <div class="relative">
    <input
      v-bind="$attrs"
      :id="id"
      v-model="model"
      :type="type"
      :disabled="disabled"
      :readonly="readonly"
      :class="
        cn(
          'w-full rounded-control border border-border bg-surface px-4 py-3 text-content-primary placeholder:text-content-tertiary transition-[border-color,box-shadow] duration-150',
          'focus-visible:border-action-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action-primary/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          clearable && 'pr-10',
          props.class,
        )
      "
    />

    <button
      v-if="showClearButton"
      type="button"
      aria-label="清除輸入內容"
      class="absolute inset-y-0 right-0 grid w-10 place-items-center text-content-tertiary transition-colors duration-150 hover:text-content-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action-primary/20"
      @pointerdown.prevent
      @click="handleClear"
    >
      <X :size="18" :stroke-width="2" aria-hidden="true" class="cursor-pointer" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { computed } from 'vue';
import { cn } from '@/utils/cn';

interface Props {
  class?: string;
  id?: string;
  type?: 'text' | 'password' | 'email' | 'search' | 'tel' | 'url' | 'number';
  clearable?: boolean;
  disabled?: boolean;
  readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  class: '',
  type: 'text',
  clearable: false,
  disabled: false,
  readonly: false,
});

const model = defineModel<string>({ default: '' });
const emit = defineEmits<{
  clear: [];
}>();

const showClearButton = computed(() => {
  return props.clearable && model.value.length > 0 && !props.disabled && !props.readonly;
});

const handleClear = () => {
  model.value = '';
  emit('clear');
};
</script>
