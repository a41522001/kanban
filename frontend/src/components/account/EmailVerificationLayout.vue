<template>
  <main class="verification-layout">
    <aside class="verification-layout__brand">
      <Logo compact class="text-content-on-dark" />
      <div class="verification-layout__message">
        <p class="verification-layout__headline">
          {{ t('auth.verification.brandLineOne') }}<br />
          {{ t('auth.verification.brandLineTwo') }}
        </p>
        <p class="mt-5 text-sm leading-5.5 text-content-on-dark-muted">
          {{ t(brandDescriptionKey) }}
        </p>
      </div>
      <div class="verification-layout__preview">
        <p class="text-[11px] leading-4 text-content-on-dark-muted">
          {{ t('auth.verification.previewLabel') }}
        </p>
        <div class="verification-layout__card">
          <p class="flex items-center gap-2 text-xs leading-4.5 text-content-secondary">
            <span
              v-if="status === 'success'"
              class="grid size-5 place-items-center rounded-full bg-flow-active-strong text-content-on-dark"
              aria-hidden="true"
            >
              <Check :size="13" :stroke-width="2.5" />
            </span>
            <span
              v-else-if="status === 'neutral'"
              class="size-2.5 rounded-full bg-content-tertiary"
              aria-hidden="true"
            ></span>
            <img v-else :src="statusDot" width="10" height="10" alt="" />
            {{ t(previewStatusKey) }}
          </p>
          <p class="text-xl font-bold leading-7">{{ t('auth.verification.taskTitle') }}</p>
          <p class="text-sm leading-5.5 text-content-secondary">
            {{ t(previewDescriptionKey) }}
          </p>
        </div>
      </div>
      <p class="verification-layout__tagline">{{ t('auth.verification.tagline') }}</p>
    </aside>
    <section class="verification-layout__content" aria-labelledby="verification-title">
      <div class="verification-layout__panel">
        <Logo compact class="mb-12 text-content-primary lg:hidden" />
        <slot />
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check } from 'lucide-vue-next';
import Logo from '@/components/shared/Logo/Logo.vue';
import statusDot from '@/assets/email-verification/status-dot.svg';
const props = withDefaults(
  defineProps<{ status?: 'pending' | 'loading' | 'success' | 'neutral' }>(),
  {
    status: 'pending',
  },
);
const { t } = useI18n();
const brandDescriptionKey = computed(() =>
  props.status === 'success'
    ? 'auth.verification.successBrandDescription'
    : props.status === 'loading'
      ? 'auth.verification.loadingBrandDescription'
      : props.status === 'neutral'
        ? 'auth.verification.neutralBrandDescription'
        : 'auth.verification.brandDescription',
);
const previewStatusKey = computed(() =>
  props.status === 'success'
    ? 'auth.verification.completed'
    : props.status === 'loading'
      ? 'auth.verification.processing'
      : props.status === 'neutral'
        ? 'auth.verification.resultUnknownStatus'
        : 'auth.verification.pending',
);
const previewDescriptionKey = computed(() =>
  props.status === 'success'
    ? 'auth.verification.successTaskDescription'
    : props.status === 'loading'
      ? 'auth.verification.loadingTaskDescription'
      : props.status === 'neutral'
        ? 'auth.verification.neutralTaskDescription'
        : 'auth.verification.taskDescription',
);
</script>

<style scoped src="./email-verification-layout.css"></style>
