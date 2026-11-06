import { describe, expect, it } from 'vitest';
import type { BoardCardSnapshot, BoardColumnSnapshot } from '@kanban/contracts/board';
import { findCardLocation, getAfterCardId, maxRevision, moveCardToColumnEnd } from './cardMove';

const makeCard = (id: string, columnId: string, position: number): BoardCardSnapshot => ({
  id,
  columnId,
  title: id,
  description: null,
  categoryId: null,
  position,
  version: 1,
  createdAt: '2026-11-06T00:00:00.000Z',
  updatedAt: '2026-11-06T00:00:00.000Z',
});

const makeBoard = (): BoardColumnSnapshot[] => [
  {
    id: 'column-1',
    title: '準備開始',
    colorKey: 'coral',
    position: 1024,
    cards: [makeCard('a', 'column-1', 1024), makeCard('b', 'column-1', 2048)],
  },
  { id: 'column-2', title: '正在進行', colorKey: 'mint', position: 2048, cards: [] },
];

describe('findCardLocation', () => {
  it('回傳卡片所在的欄位與 index', () => {
    const board = makeBoard();
    const location = findCardLocation(board, 'b');
    expect(location?.column.id).toBe('column-1');
    expect(location?.index).toBe(1);
  });

  it('找不到時回傳 null', () => {
    expect(findCardLocation(makeBoard(), 'missing')).toBeNull();
  });
});

describe('getAfterCardId', () => {
  it('第一張回傳 null（放在最上面）', () => {
    expect(getAfterCardId(makeBoard()[0]!, 0)).toBeNull();
  });

  it('其他位置回傳上一張的 id', () => {
    expect(getAfterCardId(makeBoard()[0]!, 1)).toBe('a');
  });
});

describe('moveCardToColumnEnd', () => {
  it('把卡片移到目標欄位最下面並更新 columnId', () => {
    const board = makeBoard();
    const location = moveCardToColumnEnd(board, 'a', 'column-2');

    expect(board[0]!.cards.map((card) => card.id)).toEqual(['b']);
    expect(board[1]!.cards.map((card) => card.id)).toEqual(['a']);
    expect(board[1]!.cards[0]!.columnId).toBe('column-2');
    expect(location).toMatchObject({ index: 0 });
    expect(getAfterCardId(location!.column, location!.index)).toBeNull();
  });

  it('目標欄位已有卡片時，afterCardId 是原本的最後一張', () => {
    const board = makeBoard();
    moveCardToColumnEnd(board, 'a', 'column-2');
    const location = moveCardToColumnEnd(board, 'b', 'column-2');

    expect(getAfterCardId(location!.column, location!.index)).toBe('a');
  });

  it('卡片或欄位不存在時不改動並回傳 null', () => {
    const board = makeBoard();
    expect(moveCardToColumnEnd(board, 'missing', 'column-2')).toBeNull();
    expect(moveCardToColumnEnd(board, 'a', 'missing')).toBeNull();
    expect(board[0]!.cards).toHaveLength(2);
  });
});

describe('maxRevision', () => {
  it('較晚回來、但 revision 較小的回應不會讓 revision 倒退', () => {
    expect(maxRevision('12', '11')).toBe('12');
    expect(maxRevision('12', '13')).toBe('13');
    expect(maxRevision(null, '5')).toBe('5');
  });

  it('以數值比較，不是字串比較', () => {
    expect(maxRevision('9', '10')).toBe('10');
  });
});
