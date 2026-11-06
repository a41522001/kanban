import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { CARD_CATEGORY_COLOR_KEYS, type CardCategoryColorKey } from '@kanban/contracts/board';
import { cardCategoryColorMap } from '@/constants/cardCategoryColors';
import CategoryChip from './CategoryChip.vue';

describe('CategoryChip', () => {
  it('顯示類別名稱並套用對應色票', () => {
    const wrapper = mount(CategoryChip, { props: { name: '後端', colorKey: 'mint' } });

    expect(wrapper.text()).toBe('後端');
    expect(wrapper.classes()).toContain('bg-category-mint-soft');
    expect(wrapper.classes()).toContain('text-category-mint');
  });

  it('contracts 的 14 個色票都有對應的樣式', () => {
    CARD_CATEGORY_COLOR_KEYS.forEach((colorKey) => {
      expect(cardCategoryColorMap[colorKey]).toBeDefined();
    });
  });

  it('不認得的色票退回 slate，不會讓畫面壞掉', () => {
    const wrapper = mount(CategoryChip, {
      props: { name: '舊資料', colorKey: 'unknown' as CardCategoryColorKey },
    });

    expect(wrapper.classes()).toContain('bg-category-slate-soft');
  });
});
