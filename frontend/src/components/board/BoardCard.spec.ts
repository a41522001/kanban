import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { BoardCardSnapshot } from '@kanban/contracts/board';
import BoardCard from './BoardCard.vue';

const card: BoardCardSnapshot = {
  id: 'card-1',
  columnId: 'column-1',
  title: '建立看板 API',
  description: null,
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
});
