<template>
  <EmailVerificationLayout>
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
    <div class="mt-12 border-b border-auth-border pb-4.5 lg:mt-18">
      <p class="text-xs leading-4.5 text-content-secondary">
        {{ t(copy.emailLabel) }}
      </p>
      <p class="mt-3.5 text-2xl font-medium leading-8.5 wrap-anywhere">{{ verification.email }}</p>
    </div>
    <div class="mt-10.5">
      <h2 class="text-lg font-bold leading-7">{{ t(copy.helpTitle) }}</h2>
      <p class="mt-1.25 text-sm leading-5.5 text-content-secondary">
        {{ t(copy.helpLink) }}
      </p>
      <p class="text-sm leading-5.5 text-content-secondary">
        {{ t(copy.helpDetail) }}
      </p>
      <div class="mt-7.75 flex flex-wrap items-center gap-x-5.5 gap-y-3">
        <Button
          class="h-13 w-full max-w-70"
          :class="
            isCoolingDown
              ? 'border-auth-border bg-board-page text-content-secondary disabled:opacity-100'
              : ''
          "
          :variant="isCoolingDown ? 'outline' : 'default'"
          :disabled="isCoolingDown"
          :loading="isSending"
          :aria-describedby="isCoolingDown ? 'verification-cooldown' : undefined"
          @click="sendEmail"
        >
          {{
            t(
              isSending
                ? 'auth.verification.sending'
                : verification.retryAt > 0
                  ? 'auth.verification.resend'
                  : 'auth.verification.send',
            )
          }}
        </Button>
        <p
          v-if="isCoolingDown"
          id="verification-cooldown"
          class="text-sm leading-5.5 text-content-secondary"
        >
          {{ t('auth.verification.cooldown', { time: countdown }) }}
        </p>
      </div>
      <p v-if="accepted" role="status" class="mt-4 text-sm leading-6 text-content-secondary">
        {{ t('auth.verification.accepted') }}
      </p>
    </div>
    <RouterLink
      :to="{ name: 'login' }"
      class="mt-10 inline-flex min-h-11 items-center rounded-control text-sm text-action-primary-hover underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-action-primary"
    >
      {{ t(copy.backToLogin) }}
    </RouterLink>
  </EmailVerificationLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiCode } from '@kanban/contracts/api';
import EmailVerificationLayout from '@/components/account/EmailVerificationLayout.vue';
import { Button } from '@/components/ui/button';
import { resendVerificationEmailApi } from '@/services/auth';
import { getApiErrorResponse } from '@/services/http';
import { useAlertStore } from '@/stores/alert';
import { useEmailVerificationStore } from '@/stores/emailVerification';

const { t } = useI18n();
const verification = useEmailVerificationStore();
const alert = useAlertStore();
const now = ref(Date.now());
const isSending = ref(false);
const accepted = ref(false);
const secondsLeft = computed(() =>
  Math.max(0, Math.ceil((verification.retryAt - now.value) / 1000)),
);
const isCoolingDown = computed(() => secondsLeft.value > 0);
const copy = computed(() => {
  if (verification.entry === 'signup') {
    return {
      eyebrow: 'auth.verification.signupEyebrow',
      title: 'auth.verification.signupTitle',
      description: 'auth.verification.signupDescription',
      detail: 'auth.verification.signupDetail',
      emailLabel: 'auth.verification.signupEmailLabel',
      helpTitle: 'auth.verification.signupHelpTitle',
      helpLink: 'auth.verification.signupHelpLink',
      helpDetail: isCoolingDown.value
        ? 'auth.verification.signupHelpCooldown'
        : 'auth.verification.signupHelpReady',
      backToLogin: 'auth.verification.signupBackToLogin',
    };
  }
  if (verification.entry === 'signup-error') {
    return {
      eyebrow: 'auth.verification.signupEyebrow',
      title: 'auth.verification.signupErrorTitle',
      description: 'auth.verification.signupErrorDescription',
      detail: 'auth.verification.signupErrorDetail',
      emailLabel: 'auth.verification.signupEmailLabel',
      helpTitle: 'auth.verification.signupErrorHelpTitle',
      helpLink: 'auth.verification.signupErrorHelpLink',
      helpDetail: isCoolingDown.value
        ? 'auth.verification.signupErrorHelpCooldown'
        : 'auth.verification.signupErrorHelpReady',
      backToLogin: 'auth.verification.signupBackToLogin',
    };
  }
  return {
    eyebrow: 'auth.verification.eyebrow',
    title: 'auth.verification.title',
    description: 'auth.verification.description',
    detail: isCoolingDown.value
      ? 'auth.verification.cooldownDescription'
      : 'auth.verification.readyDescription',
    emailLabel: 'auth.verification.emailLabel',
    helpTitle: 'auth.verification.helpTitle',
    helpLink: 'auth.verification.helpLink',
    helpDetail: isCoolingDown.value
      ? 'auth.verification.helpCooldown'
      : 'auth.verification.helpReady',
    backToLogin: 'auth.verification.backToLogin',
  };
});
const countdown = computed(
  () =>
    `${String(Math.floor(secondsLeft.value / 60)).padStart(2, '0')}:${String(secondsLeft.value % 60).padStart(2, '0')}`,
);
let timer: ReturnType<typeof setInterval>;
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});
onUnmounted(() => clearInterval(timer));

const updateCooldown = (data: unknown) => {
  if (
    typeof data === 'object' &&
    data !== null &&
    'retryAfterSeconds' in data &&
    typeof data.retryAfterSeconds === 'number' &&
    Number.isFinite(data.retryAfterSeconds)
  ) {
    verification.startCooldown(data.retryAfterSeconds);
    now.value = Date.now();
  }
};

const sendEmail = async () => {
  now.value = Date.now();
  if (isSending.value || isCoolingDown.value || !verification.email) return;
  isSending.value = true;
  accepted.value = false;
  try {
    const response = await resendVerificationEmailApi({ email: verification.email });
    updateCooldown(response.data);
    accepted.value = true;
  } catch (error: unknown) {
    const response = getApiErrorResponse(error);
    updateCooldown(response?.data);
    if (response?.code === ApiCode.EmailVerificationCooldown) return;
    const messageKey =
      response?.code === ApiCode.VerificationEmailQueueFailed
        ? 'auth.verification.queueFailed'
        : response?.code === ApiCode.ValidationError
          ? 'auth.verification.invalidRequest'
          : 'auth.verification.resultUnknown';
    alert.openAlert({ content: t(messageKey), confirmText: t('auth.common.confirm') });
  } finally {
    isSending.value = false;
  }
};
</script>
