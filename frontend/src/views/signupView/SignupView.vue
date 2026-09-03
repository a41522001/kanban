<template>
  <main class="signup">
    <aside class="signup__sidebar">
      <Logo class="signup__sidebar-logo" />

      <div class="signup__sidebar-content">
        <p class="signup__sidebar-title">
          {{ t('auth.sidebar.signup.titleLineOne') }}
        </p>
        <p class="signup__sidebar-title signup__sidebar-title--spaced">
          {{ t('auth.sidebar.signup.titleLineTwo') }}
        </p>
        <p class="signup__sidebar-description">{{ t('auth.sidebar.signup.description') }}</p>
        <ol class="signup__timeline">
          <li class="signup__timeline-item">
            <span class="signup__timeline-step signup__timeline-step--primary"> 01 </span>

            <div class="signup__timeline-content">
              <p class="signup__timeline-title">
                {{ t('auth.sidebar.timeline.setup.title') }}
              </p>
              <p class="signup__timeline-description">
                {{ t('auth.sidebar.timeline.setup.description') }}
              </p>
            </div>
          </li>

          <li class="signup__timeline-item">
            <span class="signup__timeline-step signup__timeline-step--active"> 02 </span>

            <div class="signup__timeline-content">
              <p class="signup__timeline-title">
                {{ t('auth.sidebar.timeline.sync.title') }}
              </p>
              <p class="signup__timeline-description">
                {{ t('auth.sidebar.timeline.sync.description') }}
              </p>
            </div>
          </li>

          <li class="signup__timeline-item">
            <span class="signup__timeline-step signup__timeline-step--pending"> 03 </span>

            <div class="signup__timeline-content">
              <p class="signup__timeline-title">
                {{ t('auth.sidebar.timeline.progress.title') }}
              </p>
              <p class="signup__timeline-description">
                {{ t('auth.sidebar.timeline.progress.description') }}
              </p>
            </div>
          </li>
        </ol>
      </div>

      <p class="signup__tagline">
        {{ t('brand.tagline') }}
      </p>
    </aside>

    <section class="signup__content">
      <div class="signup__panel">
        <div class="signup__mobile-brand">
          <Logo class="signup__mobile-logo" />
          <span class="signup__mobile-accent" />
        </div>

        <p class="signup__eyebrow">{{ t('auth.signup.eyebrow') }}</p>
        <h1 class="signup__title">
          {{ t('auth.signup.title') }}
        </h1>
        <p class="signup__description">{{ t('auth.signup.description') }}</p>

        <form class="signup__form" novalidate @submit.prevent="handleSignup">
          <FormField
            v-slot="{ invalid, describedBy }"
            class="signup__field"
            input-id="name"
            :label="t('auth.fields.name.label')"
            required
            :error="fieldErrors.displayName"
          >
            <Input
              v-model="signupForm.displayName"
              id="name"
              type="text"
              autocomplete="name"
              required
              maxlength="100"
              :invalid="invalid"
              :aria-describedby="describedBy"
              :placeholder="t('auth.fields.name.placeholder')"
              @update:model-value="clearFieldError('displayName')"
              @blur="validateField('displayName')"
            />
          </FormField>
          <FormField
            v-slot="{ invalid, describedBy }"
            class="signup__field"
            input-id="email"
            :label="t('auth.fields.email.label')"
            required
            :error="fieldErrors.email"
          >
            <Input
              v-model="signupForm.email"
              id="email"
              type="email"
              autocomplete="email"
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
            class="signup__field"
            input-id="password"
            :label="t('auth.fields.password.label')"
            required
            :error="fieldErrors.password"
          >
            <Input
              v-model="signupForm.password"
              id="password"
              type="password"
              autocomplete="new-password"
              required
              minlength="8"
              maxlength="72"
              :invalid="invalid"
              :aria-describedby="describedBy"
              :placeholder="t('auth.fields.password.placeholder')"
              @update:model-value="clearPasswordErrors"
              @blur="validatePasswordFields"
            />
          </FormField>
          <FormField
            v-slot="{ invalid, describedBy }"
            class="signup__field"
            input-id="confirmPassword"
            :label="t('auth.fields.confirmPassword.label')"
            required
            :error="fieldErrors.confirmPassword"
          >
            <Input
              v-model="signupForm.confirmPassword"
              id="confirmPassword"
              type="password"
              autocomplete="new-password"
              required
              minlength="8"
              maxlength="72"
              :invalid="invalid"
              :aria-describedby="describedBy"
              :placeholder="t('auth.fields.confirmPassword.placeholder')"
              @update:model-value="clearFieldError('confirmPassword')"
              @blur="validateField('confirmPassword')"
            />
          </FormField>
          <div class="signup__policy">
            <div class="signup__policy-choice">
              <input
                v-model="signupForm.checkPolicy"
                id="policy"
                type="checkbox"
                :class="[
                  'signup__policy-checkbox',
                  { 'signup__policy-checkbox--invalid': fieldErrors.checkPolicy },
                ]"
                :aria-invalid="Boolean(fieldErrors.checkPolicy) || undefined"
                :aria-describedby="fieldErrors.checkPolicy ? 'policy-error' : undefined"
                @change="validateField('checkPolicy')"
              />
              <label for="policy" class="signup__policy-label">{{
                t('auth.signup.agreeToPolicy')
              }}</label>
            </div>
            <p
              v-if="fieldErrors.checkPolicy"
              id="policy-error"
              class="signup__policy-error"
              role="alert"
            >
              {{ fieldErrors.checkPolicy[0] }}
            </p>
          </div>
          <Btn type="submit" :disabled="isSubmitDisabled">{{ t('auth.signup.submit') }}</Btn>
        </form>
        <div class="signup__divider">
          <span class="signup__divider-line"></span>
          <span class="signup__divider-text">{{ t('auth.common.divider') }}</span>
          <span class="signup__divider-line"></span>
        </div>
        <Btn class="signup__google-button">
          <span class="signup__google-icon"
            ><img :src="googleLogo" :alt="t('auth.common.googleLogo')"
          /></span>
          <span>{{ t('auth.common.googleSignIn') }}</span>
        </Btn>
        <div class="signup__login-prompt">
          <span class="signup__login-text">{{ t('auth.signup.hasAccount') }}</span>
          <button type="button" class="signup__login-link" @click="goLoginPage">
            {{ t('auth.signup.signIn') }}
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
import Logo from '@/components/common/Logo.vue';
import Btn from '@/components/common/Btn.vue';
import FormField from '@/components/common/FormField.vue';
import Input from '@/components/common/Input.vue';
import { isAxiosError } from 'axios';
import { computed, ref } from 'vue';
import { ApiCode, type ApiResponse } from '@kanban/contracts/api';
import { signupApi } from '@/services/auth';
import { useAlertStore } from '@/stores/alert';
import { useLoadingStore } from '@/stores/loading';
import {
  createSignupForm,
  mapSignupFieldErrors,
  toSignupRequest,
  validateSignupField,
  validateSignupForm,
  type SignupFieldMessages,
  type SignupFieldName,
} from './signup';

const { t } = useI18n();
const router = useRouter();
const alertStore = useAlertStore();
const loadingStore = useLoadingStore();
const signupForm = ref(createSignupForm());
const fieldErrors = ref<SignupFieldMessages>({});
const isSubmitting = ref(false);

const isSubmitDisabled = computed(() => {
  return isSubmitting.value;
});

const goLoginPage = () => {
  router.push({ name: 'login' });
};

const clearFieldError = (field: SignupFieldName) => {
  delete fieldErrors.value[field];
};

const clearPasswordErrors = () => {
  clearFieldError('password');
  clearFieldError('confirmPassword');
};

const validateField = (field: SignupFieldName) => {
  const messages = validateSignupField(field, signupForm.value, t);

  if (messages) {
    fieldErrors.value[field] = messages;
    return;
  }

  clearFieldError(field);
};

const validatePasswordFields = () => {
  validateField('password');

  if (signupForm.value.confirmPassword !== '') {
    validateField('confirmPassword');
  }
};

const handleSignup = async () => {
  if (isSubmitting.value) {
    return;
  }

  fieldErrors.value = validateSignupForm(signupForm.value, t);

  if (Object.keys(fieldErrors.value).length > 0) {
    return;
  }

  isSubmitting.value = true;

  try {
    const response = await loadingStore.withLoading(
      () => signupApi(toSignupRequest(signupForm.value)),
      t('auth.signup.submitting'),
    );

    alertStore.openAlert({
      content: response.message,
      confirm: goLoginPage,
    });
  } catch (error: unknown) {
    const response = isAxiosError<ApiResponse<null>>(error) ? error.response?.data : undefined;

    fieldErrors.value = mapSignupFieldErrors(response?.error ?? null);

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

<style scoped src="./signup-view.css"></style>
