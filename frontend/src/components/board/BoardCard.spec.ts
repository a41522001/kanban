import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { BoardCardSnapshot, CardCategorySnapshot } from '@kanban/contracts/board';
import BoardCard from './BoardCard.vue';

const card: BoardCardSnapshot = {
  id: 'card-1',
  columnId: 'column-1',
  title: '建立看板 API',
  description: null,
  categoryId: null,
  position: 1024,
  version: 1,
  createdAt: '2026-11-01T08:00:00.000Z',
  updatedAt: '2026-11-02T09:30:00.000Z',
};

describe('BoardCard', () => {
  it('顯示卡片標題', () => {
    const wrapper = mount(BoardCard, { props: { card } });

    expect(wrapper.text()).toContain('建立看板 API');
  });

  it('有類別時在標題上方顯示類別 chip', () => {
    const category: CardCategorySnapshot = { id: 'category-1', name: '後端', colorKey: 'mint' };
    const wrapper = mount(BoardCard, {
      props: { card: { ...card, categoryId: 'category-1' }, category },
    });

    const chip = wrapper.get('[data-testid="card-category"]');
    expect(chip.text()).toBe('後端');
    // Chip comes before the title (Board spec Q16).
    expect(wrapper.element.firstElementChild).toBe(chip.element);
  });

  it('沒有類別時不顯示 chip', () => {
    const wrapper = mount(BoardCard, { props: { card, category: null } });

    expect(wrapper.find('[data-testid="card-category"]').exists()).toBe(false);
  });
});
