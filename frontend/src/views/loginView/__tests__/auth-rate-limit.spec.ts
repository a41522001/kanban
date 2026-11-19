import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { RouterView } from 'vue-router';
import { ApiCode, type ApiResponse } from '@kanban/contracts/api';
import router from '@/router';
import { i18n } from '@/i18n';
import Alert from '@/components/app/Alert/Alert.vue';
import { loginApi, signupApi } from '@/services/auth';

vi.mock('@/services/auth', () => ({
  loginApi: vi.fn(),
  signupApi: vi.fn(),
  resendVerificationEmailApi: vi.fn(),
  verifyEmailApi: vi.fn(),
}));
vi.mock('@/services/user', () => ({ getUserInfoApi: vi.fn() }));
vi.mock('@/services/socket', () => ({ ensureConnected: vi.fn() }));
vi.mock('@/views/projectView/ProjectView.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/views/workspaceView/WorkspaceView.vue', () => ({ default: { template: '<div />' } }));
// Vitest on Windows cannot resolve the public-folder import '/img/google-logo.png' as a file path.
vi.mock('/img/google-logo.png', () => ({ default: 'google-logo.png' }));

const apiError = (code: ApiCode, data: unknown = null, message = 'API error') => ({
  isAxiosError: true,
  response: {
    data: { code, data, message, time: '', error: null } satisfies ApiResponse<unknown>,
  },
});

let wrapper: VueWrapper;
const render = async (path: string) => {
  await router.replace(path);
  wrapper = mount(
    { components: { RouterView, Alert }, template: '<RouterView /><Alert />' },
    { attachTo: document.body, global: { plugins: [createPinia(), router, i18n] } },
  );
  await flushPromises();
};
const fillLogin = async () => {
  await wrapper.get('#email').setValue('user@example.com');
  await wrapper.get('#password').setValue('password123');
};
const fillSignup = async () => {
  await wrapper.get('#name').setValue('Demo User');
  await wrapper.get('#email').setValue('user@example.com');
  await wrapper.get('#password').setValue('password123');
  await wrapper.get('#confirmPassword').setValue('password123');
  await wrapper.get('#policy').setValue(true);
};
const submit = async () => {
  await wrapper.get('form').trigger('submit');
  await flushPromises();
};
const submitButton = () => wrapper.get('button[type="submit"]');
const dialogText = () => document.querySelector('[role="alertdialog"]')?.textContent;
const tick = async (ms: number) => {
  vi.advanceTimersByTime(ms);
  await flushPromises();
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  setActivePinia(createPinia());
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2026-11-19T00:00:00Z'));
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('登入 rate limit（2009）', () => {
  it('顯示倒數並停用送出，倒數結束後恢復，密碼保留', async () => {
    // Arrange
    vi.mocked(loginApi).mockRejectedValue(
      apiError(ApiCode.LoginRateLimited, { retryAfterSeconds: 3 }),
    );
    await render('/login');
    await fillLogin();

    // Act
    await submit();

    // Assert
    const status = wrapper.get('#login-rate-limit');
    expect(status.attributes('role')).toBe('status');
    expect(status.text()).toBe('嘗試次數過多，請在 00:03 後再試。');
    expect(submitButton().attributes('disabled')).toBeDefined();
    expect(submitButton().attributes('aria-describedby')).toBe('login-rate-limit');
    // Inline countdown only; no dialog on top of it.
    expect(dialogText()).toBeUndefined();
    // The server did not check the password, so the user can retry without retyping it.
    expect((wrapper.get('#password').element as HTMLInputElement).value).toBe('password123');

    await tick(2000);
    expect(wrapper.get('#login-rate-limit').text()).toContain('00:01');
    await tick(1000);
    expect(wrapper.find('#login-rate-limit').exists()).toBe(false);
    expect(submitButton().attributes('disabled')).toBeUndefined();
  });

  it('倒數中按 Enter 送出不會再呼叫 API', async () => {
    // Arrange
    vi.mocked(loginApi).mockRejectedValue(
      apiError(ApiCode.LoginRateLimited, { retryAfterSeconds: 60 }),
    );
    await render('/login');
    await fillLogin();
    await submit();

    // Act
    await submit();

    // Assert
    expect(loginApi).toHaveBeenCalledTimes(1);
  });

  it('429 沒有可用的秒數時改用伺服器訊息，不停用送出', async () => {
    // Arrange
    vi.mocked(loginApi).mockRejectedValue(
      apiError(ApiCode.LoginRateLimited, null, '嘗試次數過多，請稍後再試'),
    );
    await render('/login');
    await fillLogin();

    // Act
    await submit();

    // Assert
    expect(dialogText()).toContain('嘗試次數過多，請稍後再試');
    expect(wrapper.find('#login-rate-limit').exists()).toBe(false);
    expect(submitButton().attributes('disabled')).toBeUndefined();
  });
});

describe('註冊 rate limit（2010）', () => {
  it('顯示倒數並停用送出，不顯示「結果不明」，倒數結束後恢復', async () => {
    // Arrange
    vi.mocked(signupApi).mockRejectedValue(
      apiError(ApiCode.SignupRateLimited, { retryAfterSeconds: 3600 }),
    );
    await render('/signup');
    await fillSignup();

    // Act
    await submit();

    // Assert
    expect(wrapper.get('#signup-rate-limit').text()).toBe('嘗試次數過多，請在 60:00 後再試。');
    expect(submitButton().attributes('disabled')).toBeDefined();
    expect(dialogText()).toBeUndefined();
    expect(router.currentRoute.value.path).toBe('/signup');

    await tick(3_600_000);
    expect(wrapper.find('#signup-rate-limit').exists()).toBe(false);
    expect(submitButton().attributes('disabled')).toBeUndefined();
  });
});
