import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { AxiosError, AxiosHeaders } from 'axios';
import type { ApiResponse } from '@kanban/contracts/api';
import { ApiCode } from '@kanban/contracts/api';
import type {
  AddCardRequest,
  BoardColumnSnapshot,
  CardMutationResult,
} from '@kanban/contracts/board';
import DialogAddCard from './DialogAddCard.vue';
import { addCardApi } from '@/services/board';

vi.mock('@/services/board', () => ({
  addCardApi: vi.fn<(data: AddCardRequest) => Promise<ApiResponse<CardMutationResult>>>(),
}));
vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn<(message: string) => void>(), error: vi.fn<(message: string) => void>() },
}));

const column: BoardColumnSnapshot = {
  id: 'column-1',
  title: '準備開始',
  colorKey: 'coral',
  position: 1024,
  cards: [],
};
const result: CardMutationResult = {
  card: {
    id: 'card-1',
    columnId: 'column-1',
    title: '建立使用者註冊 API',
    description: null,
    position: 1024,
    version: 1,
    createdAt: '2026-11-03T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
  },
  boardRevision: '5',
};

const apiError = (status: number, code: ApiCode, message: string) =>
  new AxiosError('failed', undefined, undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { code, data: null, message, time: '', error: null },
  });

const passthroughStub = { template: '<div><slot /></div>' };
const mountDialog = () =>
  mount(DialogAddCard, {
    props: { open: true, column },
    global: {
      stubs: {
        Dialog: passthroughStub,
        DialogContent: passthroughStub,
        DialogHeader: passthroughStub,
        DialogTitle: passthroughStub,
        DialogDescription: passthroughStub,
        DialogFooter: passthroughStub,
        DialogClose: passthroughStub,
      },
    },
  });

describe('DialogAddCard', () => {
  beforeEach(() => {
    vi.mocked(addCardApi).mockReset();
    vi.mocked(addCardApi).mockResolvedValue({
      code: ApiCode.Success,
      data: result,
      message: 'ok',
      time: '',
      error: null,
    });
  });

  it('顯示要新增到哪個欄位', () => {
    const wrapper = mountDialog();

    expect(wrapper.get('[data-testid="target-column"]').text()).toContain('準備開始');
  });

  it('標題空白時不送出並顯示錯誤', async () => {
    const wrapper = mountDialog();

    await wrapper.get('#card-title').setValue('   ');
    await wrapper.get('form').trigger('submit');

    expect(addCardApi).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('卡片標題不可為空');
  });

  it('送出 trim 後的內容，空白描述不送，成功後 emit created 並關閉', async () => {
    const wrapper = mountDialog();

    await wrapper.get('#card-title').setValue('  建立使用者註冊 API  ');
    await wrapper.get('#card-description').setValue('   ');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(addCardApi).toHaveBeenCalledWith({ columnId: 'column-1', title: '建立使用者註冊 API' });
    expect(wrapper.emitted('created')).toEqual([[result]]);
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
  });

  it('後端 400 時把訊息顯示在標題下方，保留輸入內容', async () => {
    vi.mocked(addCardApi).mockRejectedValue(apiError(400, ApiCode.ValidationError, '標題格式錯誤'));
    const wrapper = mountDialog();

    await wrapper.get('#card-title').setValue('標題');
    await wrapper.get('#card-description').setValue('描述內容');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('標題格式錯誤');
    expect((wrapper.get('#card-description').element as HTMLTextAreaElement).value).toBe('描述內容');
    expect(wrapper.emitted('update:open')).toBeUndefined();
  });

  it('後端 404 時 emit stale 讓看板重新載入', async () => {
    vi.mocked(addCardApi).mockRejectedValue(apiError(404, ApiCode.ResourceNotFound, 'not found'));
    const wrapper = mountDialog();

    await wrapper.get('#card-title').setValue('標題');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.emitted('stale')).toHaveLength(1);
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
  });
});
