import type { FieldErrors } from '@kanban/contracts/api';
import type { SignupRequest } from '@kanban/contracts/auth';

export interface SignupForm {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  checkPolicy: boolean;
}

export type SignupFieldName =
  'displayName' | 'email' | 'password' | 'confirmPassword' | 'checkPolicy';
export type SignupFieldMessages = Partial<Record<SignupFieldName, string[]>>;
type Translate = (key: string) => string;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPLAY_NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 320;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

export const createSignupForm = (): SignupForm => ({
  displayName: '',
  email: '',
  password: '',
  confirmPassword: '',
  checkPolicy: false,
});

export const toSignupRequest = (form: SignupForm): SignupRequest => ({
  name: form.displayName.trim(),
  email: form.email.trim(),
  password: form.password,
});

export const mapSignupFieldErrors = (errors: FieldErrors | null): SignupFieldMessages => ({
  displayName: errors?.name?.messages,
  email: errors?.email?.messages,
  password: errors?.password?.messages,
});

export const validateSignupField = (
  field: SignupFieldName,
  form: SignupForm,
  t: Translate,
): string[] | undefined => {
  switch (field) {
    case 'displayName':
      if (form.displayName.trim() === '') return [t('validation.required')];
      if (form.displayName.trim().length > DISPLAY_NAME_MAX_LENGTH) {
        return [t('validation.displayNameMaxLength')];
      }
      return undefined;
    case 'email':
      if (form.email.trim() === '') return [t('validation.required')];
      if (form.email.trim().length > EMAIL_MAX_LENGTH) return [t('validation.emailMaxLength')];
      if (!EMAIL_PATTERN.test(form.email.trim())) return [t('validation.email')];
      return undefined;
    case 'password':
      if (form.password === '') return [t('validation.required')];
      if (form.password.length < PASSWORD_MIN_LENGTH) return [t('validation.passwordMinLength')];
      if (form.password.length > PASSWORD_MAX_LENGTH) return [t('validation.passwordMaxLength')];
      return undefined;
    case 'confirmPassword':
      if (form.confirmPassword === '') return [t('validation.required')];
      if (form.password !== form.confirmPassword) return [t('validation.passwordMismatch')];
      return undefined;
    case 'checkPolicy':
      return form.checkPolicy ? undefined : [t('validation.policyRequired')];
  }
};

export const validateSignupForm = (form: SignupForm, t: Translate): SignupFieldMessages => {
  const fields: SignupFieldName[] = [
    'displayName',
    'email',
    'password',
    'confirmPassword',
    'checkPolicy',
  ];

  return Object.fromEntries(
    fields.flatMap((field) => {
      const messages = validateSignupField(field, form, t);
      return messages ? [[field, messages]] : [];
    }),
  ) as SignupFieldMessages;
};
