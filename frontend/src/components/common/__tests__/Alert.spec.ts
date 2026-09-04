import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import Alert from '@/components/common/Alert.vue';
import { i18n } from '@/i18n';
import { useAlertStore } from '@/stores/alert';

describe('Alert', () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    wrapper = mount(Alert, {
      attachTo: document.body,
      global: {
        plugins: [pinia, i18n],
      },
    });
  });

  afterEach(() => {
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('只顯示使用預設文字的確認按鈕', async () => {
    const store = useAlertStore();
    store.openAlert({ content: '儲存完成' });
    await nextTick();

    const dialog = document.body.querySelector('[role="alertdialog"]');
    const buttons = document.body.querySelectorAll('button');

    expect(dialog?.textContent).toContain('儲存完成');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent?.trim()).toBe('確認');
  });

  it('執行確認動作並關閉 Alert', async () => {
    const confirm = vi.fn();
    const store = useAlertStore();
    store.openAlert({ content: '確定刪除？', confirm });
    await nextTick();

    const confirmButton = document.body.querySelector('button');
    confirmButton?.click();
    await nextTick();

    expect(confirm).toHaveBeenCalledOnce();
    expect(store.openFlag).toBe(false);
  });

  it('有取消動作時顯示兩個自訂文字按鈕', async () => {
    const cancel = vi.fn();
    const store = useAlertStore();
    store.openAlert({
      content: '要放棄這次修改嗎？',
      confirmText: '繼續編輯',
      cancelText: '放棄修改',
      cancel,
    });
    await nextTick();

    const buttons = document.body.querySelectorAll('button');
    expect(Array.from(buttons, (button) => button.textContent?.trim())).toEqual([
      '放棄修改',
      '繼續編輯',
    ]);

    buttons[0]?.click();
    await nextTick();

    expect(cancel).toHaveBeenCalledOnce();
    expect(store.openFlag).toBe(false);
  });
});
