import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ApiCode, type ApiResponse } from '@kanban/contracts/api';
import type { PublicUser } from '@kanban/contracts/user';
import { getUserInfoApi } from '@/services/user';
import { useUserStore } from '@/stores/user';

vi.mock('@/services/user', () => ({
  getUserInfoApi: vi.fn(),
}));

const mockedGetUserInfoApi = vi.mocked(getUserInfoApi);
const user: PublicUser = {
  email: 'jeffery@example.com',
  displayName: 'Jeffery',
  avatar: null,
};

const userInfoResponse: ApiResponse<PublicUser> = {
  code: ApiCode.Success,
  data: user,
  message: '請求成功',
  time: '2026-09-03T00:00:00.000Z',
  error: null,
};

describe('user store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedGetUserInfoApi.mockReset();
  });

  it('首次載入使用者資訊後，後續導航不會重複請求', async () => {
    mockedGetUserInfoApi.mockResolvedValue(userInfoResponse);
    const store = useUserStore();

    await store.initializeUser();
    await store.initializeUser();

    expect(mockedGetUserInfoApi).toHaveBeenCalledTimes(1);
    expect(store.user).toEqual(user);
    expect(store.hasCheckedSession).toBe(true);
  });

  it('未登入結果同樣會快取，避免受保護路由重複請求', async () => {
    mockedGetUserInfoApi.mockRejectedValue(new Error('Unauthorized'));
    const store = useUserStore();

    await store.initializeUser();
    await store.initializeUser();

    expect(mockedGetUserInfoApi).toHaveBeenCalledTimes(1);
    expect(store.user).toBeNull();
    expect(store.hasCheckedSession).toBe(true);
  });

  it('同時發生的導航會共用同一個使用者資訊請求', async () => {
    let resolveRequest: (value: ApiResponse<PublicUser>) => void;
    mockedGetUserInfoApi.mockReturnValue(
      new Promise<ApiResponse<PublicUser>>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const store = useUserStore();

    const firstNavigation = store.initializeUser();
    const secondNavigation = store.initializeUser();

    expect(mockedGetUserInfoApi).toHaveBeenCalledTimes(1);
    resolveRequest!(userInfoResponse);

    await expect(firstNavigation).resolves.toEqual(user);
    await expect(secondNavigation).resolves.toEqual(user);
  });

  it('重設後會在下一次導航重新取得使用者資訊', async () => {
    mockedGetUserInfoApi.mockResolvedValue(userInfoResponse);
    const store = useUserStore();

    await store.initializeUser();
    store.resetUser();
    await store.initializeUser();

    expect(mockedGetUserInfoApi).toHaveBeenCalledTimes(2);
    expect(store.hasUser).toBe(true);
  });

  it('setAvatar 直接套用上傳結果，不重新請求使用者資訊', async () => {
    mockedGetUserInfoApi.mockResolvedValue(userInfoResponse);
    const store = useUserStore();
    await store.initializeUser();
    const avatar = { smallUrl: null, mediumUrl: 'http://localhost/md.webp', largeUrl: null };

    store.setAvatar(avatar);

    expect(store.user?.avatar).toEqual(avatar);
    expect(store.user?.displayName).toBe(user.displayName);
    expect(mockedGetUserInfoApi).toHaveBeenCalledTimes(1);
  });

  it('setAvatar(null) 移除頭像', async () => {
    mockedGetUserInfoApi.mockResolvedValue({
      ...userInfoResponse,
      data: { ...user, avatar: { smallUrl: null, mediumUrl: 'http://localhost/md.webp', largeUrl: null } },
    });
    const store = useUserStore();
    await store.initializeUser();

    store.setAvatar(null);

    expect(store.user?.avatar).toBeNull();
  });

  it('未登入時 setAvatar 不會建立使用者', () => {
    const store = useUserStore();

    store.setAvatar({ smallUrl: null, mediumUrl: 'http://localhost/md.webp', largeUrl: null });

    expect(store.user).toBeNull();
  });
});
