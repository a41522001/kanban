import { describe, expect, it } from 'vitest';
import { createLoginForm, validateLoginForm } from './login';

const t = (key: string) => key;

describe('login form validation', () => {
  it('拒絕空白欄位', () => {
    expect(validateLoginForm(createLoginForm(), t)).toEqual({
      email: ['validation.required'],
      password: ['validation.required'],
    });
  });

  it('套用與 LoginDto 相同的 Email 與密碼規則', () => {
    expect(
      validateLoginForm(
        {
          email: 'invalid-email',
          password: 'short',
        },
        t,
      ),
    ).toEqual({
      email: ['validation.email'],
      password: ['validation.passwordMinLength'],
    });
  });

  it('接受符合規則的登入資料', () => {
    expect(
      validateLoginForm(
        {
          email: 'jeffery@example.com',
          password: 'password123',
        },
        t,
      ),
    ).toEqual({});
  });
});
