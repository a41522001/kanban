import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { AxiosError, AxiosHeaders } from 'axios';
import type { ApiResponse } from '@kanban/contracts/api';
import { ApiCode } from '@kanban/contracts/api';
import type {
  AddCategoryRequest,
  AddCategoryResult,
  CardCategorySnapshot,
} from '@kanban/contracts/board';
import CategorySelect from './CategorySelect.vue';
import { addCategoryApi } from '@/services/board';

vi.mock('@/services/board', () => ({
  addCategoryApi: vi.fn<(data: AddCategoryRequest) => Promise<ApiResponse<AddCategoryResult>>>(),
}));
vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn<(message: string) => void>(), error: vi.fn<(message: string) => void>() },
}));

const categories: CardCategorySnapshot[] = [
  { id: 'category-1', name: 'Backend', colorKey: 'coral' },
  { id: 'category-2', name: '前端', colorKey: 'lavender' },
];

const mountSelect = (modelValue: string | null = null) =>
  mount(CategorySelect, {
    props: {
      modelValue,
      'onUpdate:modelValue': (value: string | null) => {
        void wrapper.setProps({ modelValue: value });
      },
      projectId: 'project-1',
      categories,
    },
    attachTo: document.body,
  });
let wrapper: ReturnType<typeof mountSelect>;

const optionTexts = () =>
  wrapper.findAll('[role="option"]').map((option) => option.text());

const open = async () => {
  await wrapper.get('#card-category').trigger('click');
};

describe('CategorySelect', () => {
  beforeEach(() => {
    vi.mocked(addCategoryApi).mockReset();
    wrapper?.unmount();
  });

  it('關閉時顯示目前選取的類別 chip', () => {
    wrapper = mountSelect('category-2');

    expect(wrapper.get('#card-category').text()).toContain('前端');
    expect(wrapper.find('#card-category-panel').exists()).toBe(false);
  });

  it('展開後列出「不設定類別」與所有類別，選取後關閉', async () => {
    wrapper = mountSelect();
    await open();

    expect(optionTexts()).toEqual(['不設定類別', 'Backend', '前端']);

    await wrapper.findAll('[role="option"]')[1]!.trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([['category-1']]);
    expect(wrapper.find('#card-category-panel').exists()).toBe(false);
  });

  it('「不設定類別」送出 null', async () => {
    wrapper = mountSelect('category-1');
    await open();

    await wrapper.findAll('[role="option"]')[0]!.trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([[null]]);
  });

  it('輸入文字不分大小寫篩選；完全相同時不出現「建立」', async () => {
    wrapper = mountSelect();
    await open();

    await wrapper.get('input').setValue('backend');

    expect(optionTexts()).toEqual(['不設定類別', 'Backend']);
    expect(wrapper.text()).not.toContain('建立「backend」');
  });

  it('名稱不存在時出現「建立」，預設第一個尚未使用的顏色', async () => {
    wrapper = mountSelect();
    await open();

    await wrapper.get('input').setValue('  文件 ');

    expect(wrapper.text()).toContain('建立「文件」');
    // coral is used by Backend, so rose (second in the palette) is preselected.
    const selected = wrapper.get('[role="radio"][aria-checked="true"]');
    expect(selected.attributes('aria-label')).toBe('玫瑰紅');
  });

  it('建立後以 trim 後的名稱與選取的顏色呼叫 API，emit created 並選取新類別', async () => {
    const result: AddCategoryResult = {
      category: { id: 'category-3', name: '文件', colorKey: 'teal' },
      boardRevision: '9',
    };
    vi.mocked(addCategoryApi).mockResolvedValue({
      code: ApiCode.Success,
      data: result,
      message: 'ok',
      time: '',
      error: null,
    });
    wrapper = mountSelect();
    await open();
    await wrapper.get('input').setValue(' 文件 ');
    await wrapper.get('[role="radio"][aria-label="青綠色"]').trigger('click');

    await wrapper.findAll('button').find((button) => button.text() === '建立')!.trigger('click');
    await flushPromises();

    expect(addCategoryApi).toHaveBeenCalledWith({
      projectId: 'project-1',
      name: '文件',
      colorKey: 'teal',
    });
    expect(wrapper.emitted('created')).toEqual([[result]]);
    expect(wrapper.emitted('update:modelValue')).toEqual([['category-3']]);
  });

  it('達到 50 個上限（7002）時在選單內顯示錯誤，不關閉', async () => {
    vi.mocked(addCategoryApi).mockRejectedValue(
      new AxiosError('failed', undefined, undefined, undefined, {
        status: 409,
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {
          code: ApiCode.CardCategoryLimitExceeded,
          data: null,
          message: '這個專案的類別已達 50 個上限',
          time: '',
          error: null,
        },
      }),
    );
    wrapper = mountSelect();
    await open();
    await wrapper.get('input').setValue('文件');

    await wrapper.get('input').trigger('keydown', { key: 'Enter' });
    await flushPromises();

    expect(wrapper.text()).toContain('這個專案的類別已達 50 個上限');
    expect(wrapper.find('#card-category-panel').exists()).toBe(true);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });
});
