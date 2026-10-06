<template>
  <EmailVerificationLayout :status="layoutStatus">
    <p class="text-xs leading-4.5 text-content-secondary">{{ t(copy.eyebrow) }}</p>
    <h1
      id="verification-title"
      class="mt-8.5 text-3xl font-bold leading-tight sm:text-[42px] sm:leading-14.5"
    >
      {{ t(copy.title) }}
    </h1>
    <div class="mt-2 space-y-0.75 text-base leading-6.5 text-content-secondary">
      <p>{{ t(copy.description) }}</p>
      <p>{{ t(copy.detail) }}</p>
    </div>

    <div class="mt-12 border-t border-auth-border pt-8">
      <h2 class="text-lg font-bold leading-7">{{ t(copy.nextTitle) }}</h2>
      <p class="mt-1.25 text-sm leading-5.5 text-content-secondary">
        {{ t(copy.nextDetail) }}
      </p>

      <p
        v-if="state === 'loading'"
        role="status"
        aria-live="polite"
        aria-busy="true"
        class="mt-10 flex items-center gap-3 text-sm font-semibold"
      >
        <LoaderCircle
          class="size-6 animate-spin text-action-primary motion-reduce:animate-none"
          aria-hidden="true"
        />
        {{ t('auth.verification.verifyLoadingStatus') }}
      </p>
      <RouterLink
        v-else-if="state === 'success'"
        :to="{ name: 'login' }"
        class="mt-10 inline-flex h-13 w-full max-w-70 items-center justify-center rounded-control bg-action-primary px-5 text-sm font-bold text-content-on-dark hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-action-primary"
      >
        {{ t('auth.verification.verifyGoLogin') }}
      </RouterLink>
      <div v-else class="mt-10 flex flex-wrap items-center gap-4">
        <Button v-if="state === 'error'" class="h-13 w-full max-w-70" @click="retry">
          {{ t('auth.verification.verifyRetry') }}
        </Button>
        <RouterLink
          :to="{ name: 'login' }"
          class="inline-flex min-h-11 items-center rounded-control text-sm text-action-primary-hover underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-action-primary"
        >
          {{ t('auth.verification.verifyGoLogin') }}
        </RouterLink>
      </div>
    </div>
  </EmailVerificationLayout>

  <AlertDialog :open="dialogOpen" @update:open="dialogOpen = $event">
    <AlertDialogContent
      class="w-full max-w-sm rounded-surface border-border bg-surface p-6 shadow-card sm:max-w-sm"
    >
      <AlertDialogHeader class="text-left">
        <AlertDialogTitle class="text-lg font-bold text-content-primary">
          {{ t(dialogTitle) }}
        </AlertDialogTitle>
        <AlertDialogDescription class="pt-2 text-sm leading-6 text-content-secondary">
          {{ t(dialogDescription) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter class="mt-6 gap-3">
        <AlertDialogCancel
          class="min-w-20 cursor-pointer rounded-control border-border-strong bg-surface px-4 py-2.5 text-sm font-bold text-content-primary hover:bg-surface-subtle"
          @click="handleDialogSecondary"
        >
          {{
            t(
              state === 'error'
                ? 'auth.verification.verifyGoLogin'
                : 'auth.verification.verifyClose',
            )
          }}
        </AlertDialogCancel>
        <AlertDialogAction
          class="min-w-20 cursor-pointer rounded-control bg-action-primary px-4 py-2.5 text-sm font-bold text-content-on-dark hover:bg-action-primary-hover"
          @click="handleDialogPrimary"
        >
          {{
            t(
              state === 'error'
                ? 'auth.verification.verifyRetry'
                : 'auth.verification.verifyGoLogin',
            )
          }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { LoaderCircle } from 'lucide-vue-next';
import { ApiCode } from '@kanban/contracts/api';
import EmailVerificationLayout from '@/components/account/EmailVerificationLayout.vue';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { verifyEmailApi } from '@/services/auth';
import { getApiErrorResponse } from '@/services/http';

type VerificationState = 'loading' | 'success' | 'invalid' | 'error';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const state = ref<VerificationState>('loading');
const dialogOpen = ref(false);
let requestId = 0;

const layoutStatus = computed(() =>
  state.value === 'loading' || state.value === 'success' ? state.value : 'neutral',
);
const copy = computed(() => {
  const key =
    state.value === 'success'
      ? 'verifySuccess'
      : state.value === 'loading'
        ? 'verifyLoading'
        : state.value === 'invalid'
          ? 'verifyInvalid'
          : 'verifyError';
  return {
    eyebrow: `auth.verification.${key}Eyebrow`,
    title: `auth.verification.${key}Title`,
    description: `auth.verification.${key}Description`,
    detail: `auth.verification.${key}Detail`,
    nextTitle: `auth.verification.${key}NextTitle`,
    nextDetail: `auth.verification.${key}NextDetail`,
  };
});
const dialogTitle = computed(() =>
  state.value === 'invalid'
    ? 'auth.verification.verifyInvalidTitle'
    : 'auth.verification.verifyErrorTitle',
);
const dialogDescription = computed(() =>
  state.value === 'invalid'
    ? 'auth.verification.verifyInvalidDialog'
    : 'auth.verification.verifyErrorDialog',
);

const showError = (result: 'invalid' | 'error') => {
  state.value = result;
  dialogOpen.value = true;
};

const verify = async () => {
  const currentRequest = ++requestId;
  const token = route.params.token;
  if (typeof token !== 'string' || token.length === 0) {
    showError('invalid');
    return;
  }

  dialogOpen.value = false;
  state.value = 'loading';
  try {
    const response = await verifyEmailApi(token);
    if (currentRequest !== requestId) return;
    if (response.code === ApiCode.Success) {
      state.value = 'success';
    } else {
      showError(response.code === ApiCode.AuthVerifyFail ? 'invalid' : 'error');
    }
  } catch (error: unknown) {
    if (currentRequest !== requestId) return;
    showError(getApiErrorResponse(error)?.code === ApiCode.AuthVerifyFail ? 'invalid' : 'error');
  }
};

const retry = () => {
  if (state.value === 'loading') return;
  void verify();
};
const goLogin = () => {
  void router.push({ name: 'login' });
};
const handleDialogPrimary = () => {
  if (state.value === 'error') retry();
  else goLogin();
};
const handleDialogSecondary = () => {
  if (state.value === 'error') goLogin();
};

watch(
  () => route.params.token,
  () => void verify(),
  { immediate: true },
);
onBeforeUnmount(() => {
  requestId++;
});
</script>
