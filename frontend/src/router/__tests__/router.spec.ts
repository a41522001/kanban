import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { ApiResponse } from '@kanban/contracts/api';
import type { PublicUser } from '@kanban/contracts/user';
import { getUserInfoApi } from '@/services/user';

vi.mock('@/services/user', () => ({ getUserInfoApi: vi.fn() }));
vi.mock('@/services/socket', () => ({
  ensureConnected: vi.fn(),
  onNotificationCreated: vi.fn(),
}));
// Views are irrelevant to routing and some pull in assets that fail to load in tests.
vi.mock('@/views/loginView/LoginView.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/views/signupView/SignupView.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/views/projectView/ProjectView.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/views/workspaceView/WorkspaceView.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/views/checkEmailView/CheckEmailView.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/views/emailVerifyView/EmailVerifyView.vue', () => ({
  default: { template: '<div />' },
}));

const user: PublicUser = { email: 'a@b.com', displayName: 'Ada', avatar: null };

const loadRouter = async () => {
  // A fresh router per test, so navigation from a previous test does not leak.
  vi.resetModules();
  return (await import('@/router')).default;
};

describe('router', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(getUserInfoApi).mockReset();
  });

  it('已登入時，根路徑導向 workspace', async () => {
    vi.mocked(getUserInfoApi).mockResolvedValue({ data: user } as ApiResponse<PublicUser>);
    const router = await loadRouter();

    await router.push('/');

    expect(router.currentRoute.value.name).toBe('workspace');
  });

  it('未登入時，根路徑導向 login', async () => {
    vi.mocked(getUserInfoApi).mockRejectedValue(new Error('401'));
    const router = await loadRouter();

    await router.push('/');

    expect(router.currentRoute.value.name).toBe('login');
  });
});
