<template>
  <main class="min-h-full h-full lg:grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
    <aside class="hidden bg-content-primary lg:grid 2xl:p-15 lg:p-10 lg:grid-rows-[auto_1fr_auto]">
      <Logo class="text-content-on-dark" />

      <div class="flex grow flex-col justify-center">
        <p class="text-[32px] text-content-on-dark font-bold">
          {{ t('auth.sidebar.signup.titleLineOne') }}
        </p>
        <p class="mb-7 text-[32px] text-content-on-dark font-bold">
          {{ t('auth.sidebar.signup.titleLineTwo') }}
        </p>
        <p class="mb-15 text-content-on-dark-muted">{{ t('auth.sidebar.signup.description') }}</p>
        <ol
          class="relative space-y-7 before:absolute before:top-4 before:bottom-4 before:left-4 before:w-px before:bg-content-on-dark/20"
        >
          <li class="relative z-10 flex gap-4">
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-full bg-action-primary text-[11px] font-bold text-content-on-dark ring-4 ring-content-primary"
            >
              01
            </span>

            <div class="pt-1">
              <p class="text-sm font-bold text-content-on-dark">
                {{ t('auth.sidebar.timeline.setup.title') }}
              </p>
              <p class="mt-1 text-sm leading-6 text-content-on-dark-muted">
                {{ t('auth.sidebar.timeline.setup.description') }}
              </p>
            </div>
          </li>

          <li class="relative z-10 flex gap-4">
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-full bg-flow-active text-[11px] font-bold text-content-primary ring-4 ring-content-primary"
            >
              02
            </span>

            <div class="pt-1">
              <p class="text-sm font-bold text-content-on-dark">
                {{ t('auth.sidebar.timeline.sync.title') }}
              </p>
              <p class="mt-1 text-sm leading-6 text-content-on-dark-muted">
                {{ t('auth.sidebar.timeline.sync.description') }}
              </p>
            </div>
          </li>

          <li class="relative z-10 flex gap-4">
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-full border border-content-on-dark/30 bg-content-primary text-[11px] font-bold text-content-on-dark ring-4 ring-content-primary"
            >
              03
            </span>

            <div class="pt-1">
              <p class="text-sm font-bold text-content-on-dark">
                {{ t('auth.sidebar.timeline.progress.title') }}
              </p>
              <p class="mt-1 text-sm leading-6 text-content-on-dark-muted">
                {{ t('auth.sidebar.timeline.progress.description') }}
              </p>
            </div>
          </li>
        </ol>
      </div>

      <p class="max-w-sm text-sm leading-6 text-content-on-dark-muted">
        {{ t('brand.tagline') }}
      </p>
    </aside>

    <section class="flex justify-center px-6 py-8 sm:px-8 sm:py-10 lg:items-center lg:px-10">
      <div class="w-full max-w-md flex flex-col">
        <div class="flex flex-col gap-6 mb-2 lg:hidden">
          <Logo class="text-content-primary" />
          <span class="w-10 h-1 bg-action-primary rounded-xl" />
        </div>

        <p class="text-content-secondary text-sm">{{ t('auth.signup.eyebrow') }}</p>
        <p class="my-2 text-3xl font-bold text-content-primary sm:my-3 sm:text-4xl">
          {{ t('auth.signup.title') }}
        </p>
        <p class="text-content-secondary text-sm">{{ t('auth.signup.description') }}</p>

        <form class="mt-8 flex flex-col sm:mt-11">
          <div class="mb-7 flex flex-col gap-3.5 sm:mb-9">
            <label for="name" class="text-content-primary font-bold">{{
              t('auth.fields.name.label')
            }}</label>
            <input
              id="name"
              type="text"
              class="input"
              :placeholder="t('auth.fields.name.placeholder')"
            />
          </div>
          <div class="mb-7 flex flex-col gap-3.5 sm:mb-9">
            <label for="email" class="text-content-primary font-bold">{{
              t('auth.fields.email.label')
            }}</label>
            <input
              id="email"
              type="text"
              class="input"
              :placeholder="t('auth.fields.email.placeholder')"
            />
          </div>
          <div class="mb-7 flex flex-col gap-3.5 sm:mb-9">
            <label for="password" class="text-content-primary font-bold">{{
              t('auth.fields.password.label')
            }}</label>
            <input
              id="password"
              type="password"
              class="input"
              :placeholder="t('auth.fields.password.placeholder')"
            />
          </div>
          <div class="mb-7 flex flex-col gap-3.5 sm:mb-9">
            <label for="confirmPassword" class="text-content-primary font-bold">{{
              t('auth.fields.confirmPassword.label')
            }}</label>
            <input
              id="confirmPassword"
              type="password"
              class="input"
              :placeholder="t('auth.fields.confirmPassword.placeholder')"
            />
          </div>
          <div class="mb-7 sm:mb-9 flex items-center">
            <input id="policy" type="checkbox" class="me-2 accent-black" />
            <label for="policy" class="text-content-secondary text-sm">{{
              t('auth.signup.agreeToPolicy')
            }}</label>
          </div>
          <Btn>{{ t('auth.signup.submit') }}</Btn>
        </form>
        <div class="flex items-center sm:my-9 my-6">
          <span class="h-px grow bg-[#D9DEE7]"></span>
          <span class="p-2 text-content-secondary text-xs">{{ t('auth.common.divider') }}</span>
          <span class="h-px grow bg-[#D9DEE7]"></span>
        </div>
        <Btn class="bg-white text-content-primary hover:bg-olive-50 mb-10 sm:mb-15">
          <span class="me-3"><img :src="googleLogo" :alt="t('auth.common.googleLogo')" /></span>
          <span>{{ t('auth.common.googleSignIn') }}</span>
        </Btn>
        <div class="flex justify-center">
          <span class="text-content-primary">{{ t('auth.signup.hasAccount') }}</span>
          <span
            class="text-action-primary-hover hover:text-action-primary font-bold cursor-pointer"
            @click="goLoginPage"
            >{{ t('auth.signup.signIn') }}</span
          >
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import googleLogo from '/img/google-logo.png';
import Logo from '@/components/common/Logo.vue';
import Btn from '@/components/common/Btn.vue';
const { t } = useI18n();
const router = useRouter();
const goLoginPage = () => {
  router.push({ name: 'login' });
};
</script>
<style scoped></style>
