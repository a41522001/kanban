<template>
  <div class="flex flex-col gap-2">
    <label v-if="label" :for="inputId" class="font-bold text-content-primary">
      {{ label }}
      <span v-if="required" class="ml-1 text-feedback-danger" aria-hidden="true">*</span>
    </label>

    <slot :invalid="hasError" :described-by="describedBy" />

    <p
      v-if="errorMessage"
      :id="errorId"
      class="text-sm text-feedback-danger"
      role="alert"
    >
      {{ errorMessage }}
    </p>
    <p v-else-if="hint" :id="hintId" class="text-sm text-content-secondary">
      {{ hint }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  inputId?: string;
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string | string[];
}

const props = withDefaults(defineProps<Props>(), {
  inputId: undefined,
  label: undefined,
  required: false,
  hint: undefined,
  error: undefined,
});

const errorMessage = computed(() => {
  if (Array.isArray(props.error)) {
    return props.error[0];
  }

  return props.error;
});

const hasError = computed(() => Boolean(errorMessage.value));
const hintId = computed(() => (props.inputId && props.hint ? `${props.inputId}-hint` : undefined));
const errorId = computed(() =>
  props.inputId && errorMessage.value ? `${props.inputId}-error` : undefined,
);
const describedBy = computed(() => errorId.value ?? hintId.value);
</script>
