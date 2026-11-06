import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { AxiosError, AxiosHeaders } from 'axios';
import type { ApiResponse } from '@kanban/contracts/api';
import { ApiCode } from '@kanban/contracts/api';
import type {
  ArchiveCardRequest,
  ArchiveCardResult,
  BoardCardSnapshot,
  CardCategorySnapshot,
  CardMutationResult,
  UpdateCardRequest,
} from '@kanban/contracts/board';
import DialogCardDetail from './DialogCardDetail.vue';
import { archiveCardApi, updateCardApi } from '@/services/board';

vi.mock('@/services/board', () => ({
  updateCardApi: vi.fn<(data: UpdateCardRequest) => Promise<ApiResponse<CardMutationResult>>>(),
  archiveCardApi: vi.fn<(data: ArchiveCardRequest) => Promise<ApiResponse<ArchiveCardResult>>>(),
}));
vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn<(message: string) => void>(), error: vi.fn<(message: string) => void>() },
}));

const card: BoardCardSnapshot = {
  id: 'card-1',
  columnId: 'column-1',
  title: 'Session Cookie 驗證流程',
  description: '使用隨機 session id',
  categoryId: null,
  position: 1024,
  version: 3,
  createdAt: '2026-11-03T02:42:00.000Z',
  updatedAt: '2026-11-03T03:05:00.000Z',
};

const success = <T,>(data: T): ApiResponse<T> => ({
  code: ApiCode.Success,
  data,
  message: 'ok',
  time: '',
  error: null,
});

const apiError = (status: number, code: ApiCode, message: string) =>
  new AxiosError('failed', undefined, undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { code, data: null, message, time: '', error: null },
  });

const categories: CardCategorySnapshot[] = [
  { id: 'category-1', name: '後端', colorKey: 'mint' },
  { id: 'category-2', name: '前端', colorKey: 'lavender' },
];

const columns = [
  { id: 'column-1', title: '正在進行' },
  { id: 'column-2', title: '等待檢視' },
];

const passthroughStub = { template: '<div><slot /></div>' };
// Renders each menu item as a plain button so tests can click it without the reka-ui portal.
const menuItemStub = {
  props: ['disabled'],
  emits: ['select'],
  template:
    '<button type="button" data-testid="move-target" :disabled="disabled" @click="$emit(\'select\')"><slot /></button>',
};
const mountDialog = (
  canEdit = true,
  cardValue: BoardCardSnapshot = card,
  columnOptions: { id: string; title: string }[] = columns,
) =>
  mount(DialogCardDetail, {
    props: {
      open: true,
      card: cardValue,
      columnTitle: '正在進行',
      canEdit,
      projectId: 'project-1',
      categories,
      columns: columnOptions,
    },
    global: {
      stubs: {
        DropdownMenu: passthroughStub,
        DropdownMenuTrigger: passthroughStub,
        DropdownMenuContent: passthroughStub,
        DropdownMenuLabel: passthroughStub,
        DropdownMenuItem: menuItemStub,
        Dialog: passthroughStub,
        DialogContent: passthroughStub,
        DialogHeader: passthroughStub,
        DialogTitle: passthroughStub,
        DialogDescription: passthroughStub,
        DialogFooter: passthroughStub,
        DialogClose: passthroughStub,
        AlertDialog: passthroughStub,
        AlertDialogContent: passthroughStub,
        AlertDialogHeader: passthroughStub,
        AlertDialogTitle: passthroughStub,
        AlertDialogDescription: passthroughStub,
        AlertDialogFooter: passthroughStub,
        AlertDialogCancel: passthroughStub,
      },
    },
  });

const findButton = (wrapper: ReturnType<typeof mountDialog>, text: string) => {
  const button = wrapper.findAll('button').find((item) => item.text() === text);
  if (!button) throw new Error(`button "${text}" not found`);
  return button;
};

const titleValue = (wrapper: ReturnType<typeof mountDialog>) =>
  (wrapper.get('#card-detail-title').element as HTMLInputElement).value;

describe('DialogCardDetail', () => {
  beforeEach(() => {
    vi.mocked(updateCardApi).mockReset();
    vi.mocked(archiveCardApi).mockReset();
    vi.mocked(updateCardApi).mockResolvedValue(
      success({ card: { ...card, title: '新標題', version: 4 }, boardRevision: '8' }),
    );
    vi.mocked(archiveCardApi).mockResolvedValue(
      success({ cardId: 'card-1', columnId: 'column-1', boardRevision: '9' }),
    );
  });

  it('打開時以卡片內容填入表單', () => {
    const wrapper = mountDialog();

    expect(titleValue(wrapper)).toBe(card.title);
    expect(wrapper.text()).toContain('位於「正在進行」');
  });

  describe('移動至…', () => {
    it('列出所有欄位，目前所在的欄位停用並標示', () => {
      const wrapper = mountDialog();
      const targets = wrapper.findAll('[data-testid="move-target"]');

      expect(targets.map((item) => item.text())).toEqual(['正在進行（目前位置）', '等待檢視']);
      expect(targets[0]!.attributes('disabled')).toBeDefined();
      expect(targets[1]!.attributes('disabled')).toBeUndefined();
    });

    it('選擇欄位時 emit move，不呼叫修改 API', async () => {
      const wrapper = mountDialog();

      await wrapper.findAll('[data-testid="move-target"]')[1]!.trigger('click');

      expect(wrapper.emitted('move')).toEqual([['column-2']]);
      expect(updateCardApi).not.toHaveBeenCalled();
    });

    it('只有一個欄位時停用「移動至…」', () => {
      const wrapper = mountDialog(true, card, [columns[0]!]);

      expect(findButton(wrapper, '移動至…').attributes('disabled')).toBeDefined();
    });

    it('VIEWER 看不到「移動至…」', () => {
      const wrapper = mountDialog(false);

      expect(wrapper.text()).not.toContain('移動至…');
    });
  });

  it('只送出有變更的欄位與 expectedVersion', async () => {
    const wrapper = mountDialog();

    await wrapper.get('#card-detail-title').setValue('  新標題 ');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(updateCardApi).toHaveBeenCalledWith({
      cardId: 'card-1',
      expectedVersion: 3,
      title: '新標題',
    });
    expect(wrapper.emitted('updated')).toHaveLength(1);
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
  });

  it('清空描述時送出空字串', async () => {
    const wrapper = mountDialog();

    await wrapper.get('#card-detail-description').setValue('');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(updateCardApi).toHaveBeenCalledWith({
      cardId: 'card-1',
      expectedVersion: 3,
      description: '',
    });
  });

  it('沒有變更時不呼叫 API 直接關閉', async () => {
    const wrapper = mountDialog();

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(updateCardApi).not.toHaveBeenCalled();
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
  });

  it('409 時顯示衝突提示、停用儲存，按重新載入會 emit reload', async () => {
    vi.mocked(updateCardApi).mockRejectedValue(
      apiError(409, ApiCode.CardVersionConflict, 'conflict'),
    );
    const wrapper = mountDialog();

    await wrapper.get('#card-detail-title').setValue('我的修改');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('這張卡片已被其他成員修改');
    expect(findButton(wrapper, '儲存').attributes('disabled')).toBeDefined();
    expect(wrapper.emitted('update:open')).toBeUndefined();

    await findButton(wrapper, '重新載入').trigger('click');
    expect(wrapper.emitted('reload')).toHaveLength(1);
  });

  it('重新載入拿到新版本後清除衝突並填入最新內容', async () => {
    vi.mocked(updateCardApi).mockRejectedValue(
      apiError(409, ApiCode.CardVersionConflict, 'conflict'),
    );
    const wrapper = mountDialog();
    await wrapper.get('#card-detail-title').setValue('我的修改');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    await wrapper.setProps({ card: { ...card, title: '別人的修改', version: 4 } });

    expect(wrapper.text()).not.toContain('這張卡片已被其他成員修改');
    expect(titleValue(wrapper)).toBe('別人的修改');
  });

  it('確認封存後以 expectedVersion 封存並 emit archived', async () => {
    const wrapper = mountDialog();

    await findButton(wrapper, '封存').trigger('click');
    await flushPromises();

    expect(archiveCardApi).toHaveBeenCalledWith({ cardId: 'card-1', expectedVersion: 3 });
    expect(wrapper.emitted('archived')).toEqual([
      [{ cardId: 'card-1', columnId: 'column-1', boardRevision: '9' }],
    ]);
  });

  it('封存遇到 409 時顯示衝突提示', async () => {
    vi.mocked(archiveCardApi).mockRejectedValue(
      apiError(409, ApiCode.CardVersionConflict, 'conflict'),
    );
    const wrapper = mountDialog();

    await findButton(wrapper, '封存').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('這張卡片已被其他成員修改');
    expect(wrapper.emitted('archived')).toBeUndefined();
  });

  it('404 時關閉並 emit stale', async () => {
    vi.mocked(archiveCardApi).mockRejectedValue(
      apiError(404, ApiCode.ResourceNotFound, 'not found'),
    );
    const wrapper = mountDialog();

    await findButton(wrapper, '封存').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('stale')).toHaveLength(1);
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
  });

  it('VIEWER 只顯示純文字，沒有輸入框與封存', () => {
    const wrapper = mountDialog(false);

    expect(wrapper.find('[data-testid="read-only"]').exists()).toBe(true);
    expect(wrapper.find('#card-detail-title').exists()).toBe(false);
    expect(wrapper.text()).toContain('檢視者 · 只能查看');
    expect(wrapper.text()).not.toContain('封存卡片');
  });

  it('改選類別時只送 categoryId', async () => {
    const wrapper = mountDialog();

    await wrapper.get('#card-category').trigger('click');
    await wrapper.findAll('[role="option"]').find((option) => option.text() === '前端')!.trigger('click');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(updateCardApi).toHaveBeenCalledWith({
      cardId: 'card-1',
      expectedVersion: 3,
      categoryId: 'category-2',
    });
  });

  it('選「不設定類別」時送 categoryId: null', async () => {
    const wrapper = mountDialog(true, { ...card, categoryId: 'category-1' });

    await wrapper.get('#card-category').trigger('click');
    await wrapper.findAll('[role="option"]')[0]!.trigger('click');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(updateCardApi).toHaveBeenCalledWith({
      cardId: 'card-1',
      expectedVersion: 3,
      categoryId: null,
    });
  });

  it('VIEWER 以 chip 顯示類別，沒有類別時顯示「沒有類別」', () => {
    const withCategory = mountDialog(false, { ...card, categoryId: 'category-1' });
    expect(withCategory.get('[data-testid="read-only"]').text()).toContain('後端');
    expect(withCategory.find('#card-category').exists()).toBe(false);

    const withoutCategory = mountDialog(false);
    expect(withoutCategory.get('[data-testid="read-only"]').text()).toContain('沒有類別');
  });
});
