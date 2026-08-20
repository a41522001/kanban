<template>
  <main class="min-h-full h-full lg:grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
    <aside class="hidden bg-content-primary lg:grid 2xl:p-15 lg:p-10 lg:grid-rows-[auto_1fr_auto]">
      <div class="flex gap-2">
        <span class="bg-action-primary w-5.5 h-7 rounded-lg mr-1"></span>
        <span class="bg-flow-active w-5.5 h-5 rounded-lg mr-4 mt-auto"></span>
        <h1 class="text-content-on-dark font-bold text-2xl leading-none">{{ t('brand.name') }}</h1>
      </div>

      <div class="flex grow flex-col justify-center">
        <p class="text-[32px] text-content-on-dark font-bold">
          {{ t('auth.sidebar.login.titleLineOne') }}
        </p>
        <p class="mb-7 text-[32px] text-content-on-dark font-bold">
          {{ t('auth.sidebar.login.titleLineTwo') }}
        </p>
        <p class="mb-15 text-content-on-dark-muted">
          {{ t('auth.sidebar.login.description') }}
        </p>
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
        <p class="text-content-secondary text-sm">{{ t('auth.login.eyebrow') }}</p>
        <p class="my-2 text-3xl font-bold text-content-primary sm:my-3 sm:text-4xl">
          {{ t('auth.login.title') }}
        </p>
        <p class="text-content-secondary text-sm">{{ t('auth.login.description') }}</p>

        <form class="mt-8 flex flex-col sm:mt-11">
          <div class="mb-7 flex flex-col gap-3.5 sm:mb-9">
            <label for="email" class="text-content-primary font-bold">{{
              t('auth.fields.email.label')
            }}</label>
            <Input
              v-model="loginForm.email"
              id="email"
              clearable
              :placeholder="t('auth.fields.email.placeholder')"
            />
          </div>
          <div class="mb-7 flex flex-col gap-3.5 sm:mb-9">
            <label for="password" class="text-content-primary font-bold">{{
              t('auth.fields.password.label')
            }}</label>
            <input
              v-model="loginForm.password"
              id="password"
              type="password"
              class="input"
              :placeholder="t('auth.fields.password.placeholder')"
            />
          </div>
          <span
            class="text-action-primary-hover ms-auto mb-6 sm:mb-8 hover:text-action-primary cursor-pointer"
            >{{ t('auth.login.forgotPassword') }}</span
          >
          <Btn @click="handleLogin">{{ t('auth.login.submit') }}</Btn>
        </form>
        <div class="flex items-center sm:my-9 my-6">
          <span class="h-px grow bg-[#D9DEE7]"></span>
          <span class="p-2 text-content-secondary text-xs">{{ t('auth.common.divider') }}</span>
          <span class="h-px grow bg-[#D9DEE7]"></span>
        </div>
        <Btn class="bg-white text-content-primary hover:bg-olive-50 mb-10 sm:mb-15">
          <span class="me-3"><img :src="googleLogo" :alt="t('auth.common.googleLogo')" /></span>
          <span>{{ t('auth.common.googleContinue') }}</span>
        </Btn>
        <div class="flex justify-center">
          <span class="text-content-primary">{{ t('auth.login.noAccount') }}</span>
          <span
            class="text-action-primary-hover hover:text-action-primary font-bold cursor-pointer"
            @click="goSignupPage"
            >{{ t('auth.login.createAccount') }}</span
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
import Btn from '@/components/common/Btn.vue';
import Input from '@/components/common/Input.vue';
import { reactive } from 'vue';
import type { LoginRequest } from '@kanban/contracts/auth';
import { loginApi } from '@/services/auth';
import { useAlertStore } from '@/stores/alert';
import { useLoadingStore } from '@/stores/loading';
const loadingStore = useLoadingStore();
const alertStore = useAlertStore();
const { t } = useI18n();
const router = useRouter();
const loginForm = reactive<LoginRequest>({
  email: '',
  password: '',
});
const goSignupPage = () => {
  router.push({ name: 'signup' });
};
const handleLogin = async (event: Event) => {
  event.preventDefault();
  try {
    loadingStore.showLoading('登入中');
    const res = await loginApi(loginForm);
    alertStore.openAlert({ content: res.message });
  } catch (error: unknown) {
    const err = error as Error;
    alertStore.openAlert({ content: err.message });
  } finally {
    loadingStore.hideLoading();
  }
};
</script>
<style scoped></style>
