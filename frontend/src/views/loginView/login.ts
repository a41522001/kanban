import type { FieldErrors } from '@kanban/contracts/api';
import type { LoginRequest } from '@kanban/contracts/auth';

export type LoginForm = LoginRequest;
export type LoginFieldName = keyof LoginForm;
export type LoginFieldMessages = Partial<Record<LoginFieldName, string[]>>;
type Translate = (key: string) => string;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 320;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

export const createLoginForm = (): LoginForm => ({
  email: '',
  password: '',
});

export const toLoginRequest = (form: LoginForm): LoginRequest => ({
  email: form.email.trim(),
  password: form.password,
});

export const mapLoginFieldErrors = (errors: FieldErrors | null): LoginFieldMessages => ({
  email: errors?.email?.messages,
  password: errors?.password?.messages,
});

export const validateLoginField = (
  field: LoginFieldName,
  form: LoginForm,
  t: Translate,
): string[] | undefined => {
  if (field === 'email') {
    if (form.email.trim() === '') return [t('validation.required')];
    if (form.email.trim().length > EMAIL_MAX_LENGTH) return [t('validation.emailMaxLength')];
    if (!EMAIL_PATTERN.test(form.email.trim())) return [t('validation.email')];
    return undefined;
  }

  if (form.password === '') return [t('validation.required')];
  if (form.password.length < PASSWORD_MIN_LENGTH) return [t('validation.passwordMinLength')];
  if (form.password.length > PASSWORD_MAX_LENGTH) return [t('validation.passwordMaxLength')];
  return undefined;
};

export const validateLoginForm = (form: LoginForm, t: Translate): LoginFieldMessages => {
  const fields: LoginFieldName[] = ['email', 'password'];

  return Object.fromEntries(
    fields.flatMap((field) => {
      const messages = validateLoginField(field, form, t);
      return messages ? [[field, messages]] : [];
    }),
  ) as LoginFieldMessages;
};
