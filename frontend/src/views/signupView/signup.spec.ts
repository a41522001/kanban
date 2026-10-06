import { describe, expect, it } from 'vitest';
import { createSignupForm, validateSignupField, validateSignupForm } from './signup';

const t = (key: string) => key;

describe('signup form validation', () => {
  it('拒絕空白、無效 Email、過短密碼、未確認密碼與未同意條款', () => {
    const errors = validateSignupForm(createSignupForm(), t);

    expect(errors).toEqual({
      displayName: ['validation.required'],
      email: ['validation.required'],
      password: ['validation.required'],
      confirmPassword: ['validation.required'],
      checkPolicy: ['validation.policyRequired'],
    });
  });

  it('套用與 SignupDto 相同的長度、Email 與確認密碼規則', () => {
    const form = {
      displayName: 'a'.repeat(101),
      email: 'invalid-email',
      password: 'short',
      confirmPassword: 'different',
      checkPolicy: true,
    };

    expect(validateSignupForm(form, t)).toEqual({
      displayName: ['validation.displayNameMaxLength'],
      email: ['validation.email'],
      password: ['validation.passwordMinLength'],
      confirmPassword: ['validation.passwordMismatch'],
    });
  });

  it('接受符合規則的欄位', () => {
    const form = {
      displayName: 'Jeffery',
      email: 'jeffery@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      checkPolicy: true,
    };

    expect(validateSignupForm(form, t)).toEqual({});
    expect(validateSignupField('password', { ...form, password: 'a'.repeat(73) }, t)).toEqual([
      'validation.passwordMaxLength',
    ]);
  });
});
