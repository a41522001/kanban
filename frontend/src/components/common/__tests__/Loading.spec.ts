import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import Loading from '@/components/common/Loading.vue';
import { useLoadingStore } from '@/stores/loading';

describe('Loading', () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    wrapper = mount(Loading, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });
  });

  afterEach(() => {
    wrapper.unmount();
    document.body.innerHTML = '';
    document.body.style.overflow = '';
  });

  it('由 store 控制顯示、文字與關閉', async () => {
    const store = useLoadingStore();
    expect(document.body.querySelector('[role="status"]')).toBeNull();

    store.showLoading('正在儲存卡片…');
    await nextTick();

    expect(document.body.querySelector('[role="status"]')?.textContent).toContain('正在儲存卡片…');
    expect(document.body.style.overflow).toBe('hidden');

    store.hideLoading();
    await nextTick();

    expect(document.body.querySelector('[role="status"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('等所有工作完成後才關閉', async () => {
    const store = useLoadingStore();
    store.showLoading();
    store.showLoading();
    await nextTick();

    const status = document.body.querySelector('[role="status"]');
    expect(status?.getAttribute('aria-label')).toBe('載入中');
    expect(status?.querySelector('p')).toBeNull();

    store.hideLoading();
    expect(store.isLoading).toBe(true);

    store.hideLoading();
    await nextTick();

    expect(store.isLoading).toBe(false);
  });

  it('withLoading 在工作完成後自動關閉', async () => {
    const store = useLoadingStore();
    const result = await store.withLoading(async () => '完成', '處理中…');

    expect(result).toBe('完成');
    expect(store.isLoading).toBe(false);
    expect(store.content).toBeNull();
  });
});
