import { describe, expect, it } from 'vitest';
import type { BoardColumnSnapshot } from '@kanban/contracts/board';
import { getAfterColumnId } from './columnMove';

const column = (id: string, position: number): BoardColumnSnapshot => ({
  id,
  title: id,
  colorKey: 'coral',
  position,
  cards: [],
});

const board = [column('todo', 1024), column('doing', 2048), column('done', 3072)];

describe('getAfterColumnId', () => {
  it('第一欄回傳 null（放在最前面）', () => {
    expect(getAfterColumnId(board, 'todo')).toBeNull();
  });

  it('其他位置回傳前一欄的 id', () => {
    expect(getAfterColumnId(board, 'done')).toBe('doing');
  });

  it('欄位不在看板上時回傳 undefined', () => {
    expect(getAfterColumnId(board, 'missing')).toBeUndefined();
  });
});
