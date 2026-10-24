<template>
  <span class="shared-avatar" :class="sizeClass">
    <img
      v-if="showImage"
      class="shared-avatar__image"
      :src="src!"
      :alt="name"
      :width="size"
      :height="size"
      decoding="async"
      @error="hasLoadError = true"
    />
    <span v-else class="shared-avatar__initial" :aria-label="name" role="img">
      {{ initial }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

defineOptions({ name: 'SharedAvatar' });

/** Rendered size in px; named by pixels to avoid confusion with the sm/md/lg image files. */
export type AvatarSize = 32 | 40 | 64 | 128;

interface Props {
  name: string;
  src?: string | null;
  size?: AvatarSize;
}

const props = withDefaults(defineProps<Props>(), {
  src: null,
  size: 32,
});

const hasLoadError = ref(false);

const initial = computed(() => props.name.trim().charAt(0).toUpperCase() || '?');
const showImage = computed(() => Boolean(props.src) && !hasLoadError.value);

const sizeClasses: Record<AvatarSize, string> = {
  32: 'size-8 text-sm',
  40: 'size-10 text-base',
  64: 'size-16 text-2xl',
  128: 'size-32 text-5xl',
};
const sizeClass = computed(() => sizeClasses[props.size]);

// A new URL deserves a fresh attempt even if the previous one failed.
watch(
  () => props.src,
  () => {
    hasLoadError.value = false;
  },
);
</script>

<style scoped src="./Avatar.css"></style>
