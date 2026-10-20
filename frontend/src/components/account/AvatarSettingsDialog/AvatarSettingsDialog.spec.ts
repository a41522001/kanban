import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h } from 'vue';
import { AxiosError, AxiosHeaders } from 'axios';
import { ApiCode, type ApiResponse } from '@kanban/contracts/api';
import type { AvatarImageSet } from '@kanban/contracts/avatar';
import type { PublicUser } from '@kanban/contracts/user';
import { toast } from 'vue-sonner';
import AvatarSettingsDialog from './AvatarSettingsDialog.vue';
import { i18n } from '@/i18n';
import { deleteAvatarApi, uploadAvatarApi } from '@/services/avatar';
import { useUserStore } from '@/stores/user';

vi.mock('@/services/avatar', () => ({
  uploadAvatarApi: vi.fn<(image: Blob) => Promise<ApiResponse<AvatarImageSet>>>(),
  deleteAvatarApi: vi.fn<() => Promise<ApiResponse<null>>>(),
}));
vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn<(message: string) => void>(), error: vi.fn<(message: string) => void>() },
}));

// jsdom has no canvas; the stub exposes the same instance API the dialog relies on.
const zoom = vi.fn<(factor: number) => void>();
vi.mock('vue-advanced-cropper', () => ({
  Cropper: defineComponent({
    name: 'CropperStub',
    setup(_, { expose }) {
      expose({
        zoom,
        getResult: () => ({
          canvas: {
            toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob(['png'], { type: 'image/png' })),
          },
        }),
      });
      return () => h('div', { 'data-test': 'cropper' });
    },
  }),
  CircleStencil: {},
  Preview: defineComponent({ name: 'PreviewStub', setup: () => () => h('div') }),
}));
vi.mock('vue-advanced-cropper/dist/style.css', () => ({}));

const avatar: AvatarImageSet = {
  smallUrl: null,
  mediumUrl: 'http://localhost:4001/media/avatars/upload-1/md.webp',
  largeUrl: null,
};
const apiResponse = <T>(data: T): ApiResponse<T> => ({ code: ApiCode.Success, data, message: 'ok', time: '', error: null });

const passthroughStub = { template: '<div><slot /></div>' };
const mountDialog = () =>
  mount(AvatarSettingsDialog, {
    props: { open: true },
    global: {
      plugins: [i18n],
      stubs: {
        Dialog: passthroughStub,
        DialogContent: passthroughStub,
        DialogHeader: passthroughStub,
        DialogTitle: passthroughStub,
        DialogDescription: passthroughStub,
        DialogFooter: passthroughStub,
      },
    },
  });

const setUser = (userAvatar: AvatarImageSet | null) => {
  const store = useUserStore();
  store.user = { email: 'j@example.com', displayName: 'Jeffery', avatar: userAvatar } satisfies PublicUser;
  return store;
};

const chooseFile = async (wrapper: ReturnType<typeof mountDialog>, file: File) => {
  const input = wrapper.get('input[type="file"]');
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
  await input.trigger('change');
};

const buttonByText = (wrapper: ReturnType<typeof mountDialog>, label: string) =>
  wrapper.findAll('button').find((button) => button.text().includes(label));

describe('AvatarSettingsDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    i18n.global.locale.value = 'zh-TW';
    vi.mocked(uploadAvatarApi).mockReset();
    vi.mocked(deleteAvatarApi).mockReset();
    vi.mocked(toast.success).mockReset();
    zoom.mockReset();
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn<(object: Blob) => string>(() => 'blob:preview'), revokeObjectURL: vi.fn<(url: string) => void>() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('已有頭像時顯示目前頭像、選擇新圖片與移除頭像', () => {
    setUser(avatar);
    const wrapper = mountDialog();

    expect(wrapper.get('img').attributes('src')).toBe(avatar.mediumUrl);
    expect(buttonByText(wrapper, '選擇新圖片')).toBeDefined();
    expect(buttonByText(wrapper, '移除頭像')).toBeDefined();
  });

  it('尚未設定頭像時顯示首字，且不提供移除', () => {
    setUser(null);
    const wrapper = mountDialog();

    expect(wrapper.find('img').exists()).toBe(false);
    expect(buttonByText(wrapper, '選擇圖片')).toBeDefined();
    expect(buttonByText(wrapper, '移除頭像')).toBeUndefined();
  });

  it('選擇不支援的格式時顯示錯誤，不進入裁切', async () => {
    setUser(null);
    const wrapper = mountDialog();

    await chooseFile(wrapper, new File(['gif'], 'a.gif', { type: 'image/gif' }));

    expect(wrapper.text()).toContain('不支援這個檔案格式');
    expect(wrapper.find('[data-test="cropper"]').exists()).toBe(false);
  });

  it('上傳成功後更新 store、顯示 Toast 並關閉 Dialog', async () => {
    const store = setUser(null);
    const uploaded = { ...avatar, mediumUrl: 'http://localhost:4001/media/avatars/upload-2/md.webp' };
    vi.mocked(uploadAvatarApi).mockResolvedValue(apiResponse(uploaded));
    const wrapper = mountDialog();
    await chooseFile(wrapper, new File(['png'], 'a.png', { type: 'image/png' }));

    await buttonByText(wrapper, '上傳')!.trigger('click');
    await flushPromises();

    expect(vi.mocked(uploadAvatarApi).mock.calls[0]![0]).toBeInstanceOf(Blob);
    expect(store.user?.avatar).toEqual(uploaded);
    expect(toast.success).toHaveBeenCalledWith('頭像已更新');
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
  });

  it('伺服器回 429 時倒數，歸零前不能再次上傳', async () => {
    vi.useFakeTimers();
    setUser(null);
    const config = { headers: new AxiosHeaders() };
    vi.mocked(uploadAvatarApi).mockRejectedValue(
      new AxiosError('Too Many Requests', 'ERR_BAD_REQUEST', config, undefined, {
        status: 429,
        statusText: '',
        headers: {},
        config,
        data: { code: ApiCode.AvatarRateLimited, message: '', time: '', data: { retryAfterSeconds: 2 }, error: null },
      }),
    );
    const wrapper = mountDialog();
    await chooseFile(wrapper, new File(['png'], 'a.png', { type: 'image/png' }));

    await buttonByText(wrapper, '上傳')!.trigger('click');
    await flushPromises();

    const retryButton = buttonByText(wrapper, '秒後可上傳')!;
    expect(retryButton.text()).toContain('2 秒後可上傳');
    expect(retryButton.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('上傳太頻繁');

    await vi.advanceTimersByTimeAsync(2000);

    expect(buttonByText(wrapper, '上傳')!.attributes('disabled')).toBeUndefined();
  });

  it('上傳失敗時依 ApiCode 顯示文案，而非後端 message', async () => {
    setUser(null);
    const config = { headers: new AxiosHeaders() };
    vi.mocked(uploadAvatarApi).mockRejectedValue(
      new AxiosError('Bad Request', 'ERR_BAD_REQUEST', config, undefined, {
        status: 400,
        statusText: '',
        headers: {},
        config,
        data: { code: ApiCode.AvatarInvalidImage, message: 'sharp internal error', time: '', data: null, error: null },
      }),
    );
    const wrapper = mountDialog();
    await chooseFile(wrapper, new File(['png'], 'a.png', { type: 'image/png' }));

    await buttonByText(wrapper, '上傳')!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('無法讀取這張圖片');
    expect(wrapper.text()).not.toContain('sharp internal error');
  });

  it('縮放按鈕以相對倍率呼叫 cropper.zoom', async () => {
    setUser(null);
    const wrapper = mountDialog();
    await chooseFile(wrapper, new File(['png'], 'a.png', { type: 'image/png' }));

    await wrapper.get('button[aria-label="放大"]').trigger('click');

    expect(zoom).toHaveBeenCalledWith(1.2 / 1);
  });

  it('移除頭像成功後 store 的 avatar 變為 null，Dialog 維持開啟', async () => {
    const store = setUser(avatar);
    vi.mocked(deleteAvatarApi).mockResolvedValue(apiResponse(null));
    const wrapper = mountDialog();

    await buttonByText(wrapper, '移除頭像')!.trigger('click');
    await flushPromises();

    expect(store.user?.avatar).toBeNull();
    expect(buttonByText(wrapper, '移除頭像')).toBeUndefined();
    expect(wrapper.emitted('update:open')).toBeUndefined();
  });
});
