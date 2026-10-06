import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { RouterView } from 'vue-router';
import { ApiCode, type ApiResponse } from '@kanban/contracts/api';
import router from '@/router';
import { i18n } from '@/i18n';
import Alert from '@/components/app/Alert/Alert.vue';
import { loginApi, signupApi, resendVerificationEmailApi, verifyEmailApi } from '@/services/auth';
import { getUserInfoApi } from '@/services/user';
import { ensureConnected } from '@/services/socket';
import { useEmailVerificationStore } from '@/stores/emailVerification';

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

const response = <T>(data: T, code = ApiCode.Success): ApiResponse<T> => ({
  code,
  data,
  message: 'API result',
  time: '',
  error: null,
});

const apiError = (code: ApiCode, data: unknown = null) => ({
  isAxiosError: true,
  response: { data: response(data, code) },
});
let wrapper: VueWrapper;
let pinia: ReturnType<typeof createPinia>;
const render = async (path: string) => {
  await router.replace(path);
  wrapper = mount(
    { components: { RouterView, Alert }, template: '<RouterView /><Alert />' },
    {
      attachTo: document.body,
      global: { plugins: [pinia, router, i18n] },
    },
  );
  await flushPromises();
};
const login = async () => {
  await wrapper.get('#email').setValue('User@example.com');
  await wrapper.get('#password').setValue('password123');
  await wrapper.get('form').trigger('submit');
  await flushPromises();
};
const signup = async () => {
  await wrapper.get('#name').setValue('Demo User');
  await wrapper.get('#email').setValue('user@example.com');
  await wrapper.get('#password').setValue('password123');
  await wrapper.get('#confirmPassword').setValue('password123');
  await wrapper.get('#policy').setValue(true);
  await wrapper.get('form').trigger('submit');
  await flushPromises();
};
const showNotice = async () => {
  useEmailVerificationStore().setEmail('user@example.com');
  await render('/checkEmail');
};
const dialogText = () => document.querySelector('[role="alertdialog"]')?.textContent;

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  pinia = createPinia();
  setActivePinia(pinia);
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2026-09-28T00:00:00Z'));
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('email verification stage 1', () => {
  it('新使用者註冊後直接查看信箱與首次冷卻，不必重新登入或再寄一次', async () => {
    vi.mocked(signupApi).mockResolvedValue(
      response({ accountCreated: true, emailQueued: true, retryAfterSeconds: 60 }),
    );
    await render('/signup');
    await signup();
    expect(router.currentRoute.value.path).toBe('/checkEmail');
    expect(wrapper.get('h1').text()).toBe('請查看你的信箱');
    expect(wrapper.text()).toContain('驗證信已安排寄送');
    expect(wrapper.text()).toContain('01:00 後可再次寄送');
    expect(wrapper.text()).toContain('完成驗證後，前往登入');
    expect(dialogText()).toBeUndefined();
    expect(resendVerificationEmailApi).not.toHaveBeenCalled();
  });

  it('帳號已建立但入列失敗時，留在信箱頁提供重寄與冷卻', async () => {
    vi.mocked(signupApi).mockResolvedValue(
      response(
        { accountCreated: true, emailQueued: false, retryAfterSeconds: 60 },
        ApiCode.SignupEmailQueueFailed,
      ),
    );
    await render('/signup');
    await signup();
    expect(router.currentRoute.value.path).toBe('/checkEmail');
    expect(wrapper.get('h1').text()).toBe('帳號已建立');
    expect(wrapper.text()).toContain('這封驗證信尚未安排寄送');
    expect(dialogText()).toContain('暫時無法安排驗證信');
    expect(wrapper.text()).toContain('01:00 後可再次寄送');
    expect(resendVerificationEmailApi).not.toHaveBeenCalled();
  });

  it('Email 已註冊時顯示欄位錯誤，網路錯誤則保留表單並說明結果不明', async () => {
    vi.mocked(signupApi)
      .mockRejectedValueOnce(apiError(ApiCode.EmailAlreadyRegistered))
      .mockRejectedValueOnce(new Error('network'));
    await render('/signup');
    await signup();
    expect(wrapper.text()).toContain('此電子郵件已被註冊');
    expect(dialogText()).toBeUndefined();
    await signup();
    expect(dialogText()).toContain('無法確認註冊結果');
    expect(router.currentRoute.value.path).toBe('/signup');
  });

  it('未驗證登入帶入伺服器 Email，公開頁不查 Session、不連 Socket、不自動寄信', async () => {
    vi.mocked(loginApi).mockRejectedValue(
      apiError(ApiCode.EmailVerificationRequired, { email: 'user@example.com' }),
    );
    await render('/login');
    await login();
    expect(router.currentRoute.value.path).toBe('/checkEmail');
    expect(wrapper.text()).toContain('user@example.com');
    expect(wrapper.get('h1').text()).toBe('請先驗證電子郵件');
    expect(getUserInfoApi).not.toHaveBeenCalled();
    expect(ensureConnected).not.toHaveBeenCalled();
    expect(resendVerificationEmailApi).not.toHaveBeenCalled();
    expect(JSON.stringify(sessionStorage)).not.toContain('password123');
  });

  it('帳密錯誤停留登入；沒有信箱 context 不能直接進提示頁', async () => {
    vi.mocked(loginApi).mockRejectedValue(apiError(ApiCode.InvalidCredentials));
    await render('/login');
    await login();
    expect(router.currentRoute.value.path).toBe('/login');
    expect(dialogText()).toBeTruthy();
    await router.push('/checkEmail');
    expect(router.currentRoute.value.path).toBe('/login');
  });

  it('待受理時防止重複請求，202 後顯示受理與倒數', async () => {
    let finish!: (value: ApiResponse<{ retryAfterSeconds: number }>) => void;
    vi.mocked(resendVerificationEmailApi).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await showNotice();
    const button = wrapper.get('button');
    await button.trigger('click');
    await button.trigger('click');
    expect(resendVerificationEmailApi).toHaveBeenCalledExactlyOnceWith({
      email: 'user@example.com',
    });
    expect(button.attributes('disabled')).toBeDefined();
    finish(response({ retryAfterSeconds: 42 }));
    await flushPromises();
    expect(wrapper.text()).toContain('00:42 後可再次寄送');
    expect(wrapper.get('[role="status"]').text()).toContain('重寄申請已受理');
    expect(dialogText()).toBeUndefined();
  });

  it('429 使用後端秒數，倒數結束恢復按鈕但不自動寄信', async () => {
    vi.mocked(resendVerificationEmailApi).mockRejectedValue(
      apiError(ApiCode.EmailVerificationCooldown, { retryAfterSeconds: 7 }),
    );
    await showNotice();
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('00:07 後可再次寄送');
    expect(dialogText()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(7000);
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined();
    expect(resendVerificationEmailApi).toHaveBeenCalledOnce();
  });

  it('503 顯示失敗 Dialog 且保留冷卻與信箱', async () => {
    vi.mocked(resendVerificationEmailApi).mockRejectedValue(
      apiError(ApiCode.VerificationEmailQueueFailed, { retryAfterSeconds: 30 }),
    );
    await showNotice();
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(dialogText()).toContain('暫時無法安排寄送驗證信');
    expect(wrapper.text()).toContain('00:30 後可再次寄送');
    expect(wrapper.text()).toContain('user@example.com');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });

  it('重寄網路錯誤不宣稱未寄出，亦不憑空建立倒數', async () => {
    vi.mocked(resendVerificationEmailApi).mockRejectedValue(new Error('network'));
    await showNotice();
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(dialogText()).toContain('無法確認是否已受理');
    expect(wrapper.find('#verification-cooldown').exists()).toBe(false);
  });

  it('重整恢復原截止時間；切換信箱不沿用另一帳號的倒數', async () => {
    const original = useEmailVerificationStore();
    original.setEmail('user@example.com');
    original.startCooldown(60);
    vi.setSystemTime(Date.now() + 18000);
    pinia = createPinia();
    setActivePinia(pinia);
    await render('/checkEmail');
    expect(wrapper.text()).toContain('00:42 後可再次寄送');
    expect(resendVerificationEmailApi).not.toHaveBeenCalled();
    useEmailVerificationStore().setEmail('other@example.com');
    await flushPromises();
    expect(wrapper.text()).toContain('other@example.com');
    expect(wrapper.find('#verification-cooldown').exists()).toBe(false);
  });
});

describe('email verification stage 2', () => {
  it('公開驗證頁只送出一次 PATCH，等待回應時顯示處理中', async () => {
    let finish!: (value: ApiResponse<null>) => void;
    vi.mocked(verifyEmailApi).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await render('/verifyEmail/email-token');
    expect(verifyEmailApi).toHaveBeenCalledExactlyOnceWith('email-token');
    expect(wrapper.get('h1').text()).toBe('正在驗證你的電子郵件');
    expect(wrapper.get('[role="status"]').text()).toContain('驗證中');
    expect(getUserInfoApi).not.toHaveBeenCalled();
    expect(ensureConnected).not.toHaveBeenCalled();
    finish(response(null));
    await flushPromises();
    expect(wrapper.get('h1').text()).toBe('電子郵件驗證成功');
    expect(wrapper.text()).toContain('已完成');
    expect(wrapper.get('a[href="/login"]').text()).toBe('前往登入');
    expect(dialogText()).toBeUndefined();
  });

  it('失效連結顯示中性畫面與 Dialog，缺少 token 不送請求', async () => {
    vi.mocked(verifyEmailApi).mockRejectedValue(apiError(ApiCode.AuthVerifyFail));
    await render('/verifyEmail/expired-token');
    expect(wrapper.get('h1').text()).toBe('此驗證連結已無法使用');
    expect(dialogText()).toContain('連結可能已過期或已使用');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('已完成');
    wrapper.unmount();
    document.body.innerHTML = '';
    vi.clearAllMocks();
    await render('/verifyEmail');
    expect(verifyEmailApi).not.toHaveBeenCalled();
    expect(wrapper.get('h1').text()).toBe('此驗證連結已無法使用');
    expect(dialogText()).toContain('連結可能已過期或已使用');
  });

  it('網路錯誤不判定連結失效；使用者按再試一次才重新請求', async () => {
    vi.mocked(verifyEmailApi)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(response(null));
    await render('/verifyEmail/email-token');
    expect(wrapper.get('h1').text()).toBe('暫時無法確認驗證結果');
    expect(dialogText()).toContain('網路或服務暫時發生問題');
    expect(verifyEmailApi).toHaveBeenCalledOnce();
    const retryButton = Array.from(document.querySelectorAll('[role="alertdialog"] button')).find(
      (button) => button.textContent?.includes('再試一次'),
    ) as HTMLButtonElement;
    retryButton.click();
    await flushPromises();
    expect(verifyEmailApi).toHaveBeenCalledTimes(2);
    expect(wrapper.get('h1').text()).toBe('電子郵件驗證成功');
    expect(dialogText()).toBeUndefined();
  });

  it('服務錯誤後重試若回 2004，仍提示先登入確認驗證狀態', async () => {
    vi.mocked(verifyEmailApi)
      .mockRejectedValueOnce(apiError(ApiCode.InternalError))
      .mockRejectedValueOnce(apiError(ApiCode.AuthVerifyFail));
    await render('/verifyEmail/email-token');
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.get('h1').text()).toBe('此驗證連結已無法使用');
    expect(dialogText()).toContain('請先登入確認是否完成驗證');
  });
});
