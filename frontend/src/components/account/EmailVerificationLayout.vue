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
          {{ t('auth.verification.brandDescription') }}
        </p>
      </div>
      <div class="verification-layout__preview">
        <p class="text-[11px] leading-4 text-content-on-dark-muted">
          {{ t('auth.verification.previewLabel') }}
        </p>
        <div class="verification-layout__card">
          <p class="flex items-center gap-2 text-xs leading-4.5 text-content-secondary">
            <img :src="statusDot" width="10" height="10" alt="" />
            {{ t('auth.verification.pending') }}
          </p>
          <p class="text-xl font-bold leading-7">{{ t('auth.verification.taskTitle') }}</p>
          <p class="text-sm leading-5.5 text-content-secondary">
            {{ t('auth.verification.taskDescription') }}
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
import { useI18n } from 'vue-i18n';
import Logo from '@/components/shared/Logo/Logo.vue';
import statusDot from '@/assets/email-verification/status-dot.svg';
const { t } = useI18n();
</script>

<style scoped src="./email-verification-layout.css"></style>
