<template>
  <main class="login">
    <aside class="login__sidebar">
      <Logo class="login__sidebar-logo" />

      <div class="login__sidebar-content">
        <p class="login__sidebar-title">
          {{ t('auth.sidebar.login.titleLineOne') }}
        </p>
        <p class="login__sidebar-title login__sidebar-title--spaced">
          {{ t('auth.sidebar.login.titleLineTwo') }}
        </p>
        <p class="login__sidebar-description">
          {{ t('auth.sidebar.login.description') }}
        </p>
        <ol class="login__timeline">
          <li class="login__timeline-item">
            <span class="login__timeline-step login__timeline-step--primary"> 01 </span>

            <div class="login__timeline-content">
              <p class="login__timeline-title">
                {{ t('auth.sidebar.timeline.setup.title') }}
              </p>
              <p class="login__timeline-description">
                {{ t('auth.sidebar.timeline.setup.description') }}
              </p>
            </div>
          </li>

          <li class="login__timeline-item">
            <span class="login__timeline-step login__timeline-step--active"> 02 </span>

            <div class="login__timeline-content">
              <p class="login__timeline-title">
                {{ t('auth.sidebar.timeline.sync.title') }}
              </p>
              <p class="login__timeline-description">
                {{ t('auth.sidebar.timeline.sync.description') }}
              </p>
            </div>
          </li>

          <li class="login__timeline-item">
            <span class="login__timeline-step login__timeline-step--pending"> 03 </span>

            <div class="login__timeline-content">
              <p class="login__timeline-title">
                {{ t('auth.sidebar.timeline.progress.title') }}
              </p>
              <p class="login__timeline-description">
                {{ t('auth.sidebar.timeline.progress.description') }}
              </p>
            </div>
          </li>
        </ol>
      </div>

      <p class="login__tagline">
        {{ t('brand.tagline') }}
      </p>
    </aside>

    <section class="login__content">
      <div class="login__panel">
        <div class="login__mobile-brand">
          <Logo class="login__mobile-logo" />
          <span class="login__mobile-accent" />
        </div>

        <p class="login__eyebrow">{{ t('auth.login.eyebrow') }}</p>
        <h1 class="login__title">
          {{ t('auth.login.title') }}
        </h1>
        <p class="login__description">{{ t('auth.login.description') }}</p>

        <form class="login__form" novalidate @submit.prevent="handleLogin">
          <FormField
            v-slot="{ invalid, describedBy }"
            class="login__field"
            input-id="email"
            :label="t('auth.fields.email.label')"
            required
            :error="fieldErrors.email"
          >
            <Input
              v-model="loginForm.email"
              id="email"
              type="email"
              autocomplete="email"
              clearable
              required
              maxlength="320"
              :invalid="invalid"
              :aria-describedby="describedBy"
              :placeholder="t('auth.fields.email.placeholder')"
              @update:model-value="clearFieldError('email')"
              @blur="validateField('email')"
            />
          </FormField>
          <FormField
            v-slot="{ invalid, describedBy }"
            class="login__field"
            input-id="password"
            :label="t('auth.fields.password.label')"
            required
            :error="fieldErrors.password"
          >
            <Input
              v-model="loginForm.password"
              id="password"
              type="password"
              autocomplete="current-password"
              required
              minlength="8"
              maxlength="72"
              :invalid="invalid"
              :aria-describedby="describedBy"
              :placeholder="t('auth.fields.password.placeholder')"
              @update:model-value="clearFieldError('password')"
              @blur="validateField('password')"
            />
          </FormField>
          <button type="button" class="login__forgot-password">
            {{ t('auth.login.forgotPassword') }}
          </button>
          <Button type="submit" :disabled="isSubmitDisabled" :loading="isSubmitting">
            {{ t('auth.login.submit') }}
          </Button>
        </form>
        <div class="login__divider">
          <span class="login__divider-line"></span>
          <span class="login__divider-text">{{ t('auth.common.divider') }}</span>
          <span class="login__divider-line"></span>
        </div>
        <Button variant="secondary" class="login__google-button">
          <span class="login__google-icon"
            ><img :src="googleLogo" :alt="t('auth.common.googleLogo')"
          /></span>
          <span>{{ t('auth.common.googleContinue') }}</span>
        </Button>
        <div class="login__signup-prompt">
          <span class="login__signup-text">{{ t('auth.login.noAccount') }}</span>
          <button type="button" class="login__signup-link" @click="goSignupPage">
            {{ t('auth.login.createAccount') }}
          </button>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import googleLogo from '/img/google-logo.png';
import { Button } from '@/components/ui/button';
import FormField from '@/components/common/FormField.vue';
import Input from '@/components/common/Input.vue';
import Logo from '@/components/common/Logo.vue';
import { isAxiosError } from 'axios';
import { computed, ref } from 'vue';
import { ApiCode, type ApiResponse } from '@kanban/contracts/api';
import { loginApi } from '@/services/auth';
import { useAlertStore } from '@/stores/alert';
import { useLoadingStore } from '@/stores/loading';
import { useUserStore } from '@/stores/user';
import {
  createLoginForm,
  mapLoginFieldErrors,
  toLoginRequest,
  validateLoginField,
  validateLoginForm,
  type LoginFieldMessages,
  type LoginFieldName,
} from './login';

const { t } = useI18n();
const router = useRouter();
const loadingStore = useLoadingStore();
const alertStore = useAlertStore();
const userStore = useUserStore();
const loginForm = ref(createLoginForm());
const fieldErrors = ref<LoginFieldMessages>({});
const isSubmitting = ref(false);

const isSubmitDisabled = computed(() => {
  return isSubmitting.value;
});

const goSignupPage = () => {
  router.push({ name: 'signup' });
};

const goBoardPage = () => {
  userStore.resetUser();
  void router.push({ name: 'board' });
};

const clearFieldError = (field: LoginFieldName) => {
  delete fieldErrors.value[field];
};

const validateField = (field: LoginFieldName) => {
  const messages = validateLoginField(field, loginForm.value, t);

  if (messages) {
    fieldErrors.value[field] = messages;
    return;
  }

  clearFieldError(field);
};

const handleLogin = async () => {
  if (isSubmitDisabled.value) {
    return;
  }

  fieldErrors.value = validateLoginForm(loginForm.value, t);

  if (Object.keys(fieldErrors.value).length > 0) {
    return;
  }

  isSubmitting.value = true;

  try {
    const response = await loadingStore.withLoading(
      () => loginApi(toLoginRequest(loginForm.value)),
      t('auth.login.submitting'),
    );

    alertStore.openAlert({
      content: response.message,
      confirm: goBoardPage,
    });
  } catch (error: unknown) {
    const response = isAxiosError<ApiResponse<null>>(error) ? error.response?.data : undefined;

    fieldErrors.value = mapLoginFieldErrors(response?.error ?? null);

    if (response?.code === ApiCode.ValidationError) {
      return;
    }

    alertStore.openAlert({
      content: response?.message ?? t('error.requestFailed'),
    });
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped src="./login-view.css"></style>
