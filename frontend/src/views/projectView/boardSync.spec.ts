import { describe, expect, it, vi } from 'vitest';
import type {
  BoardCardSnapshot,
  BoardColumnSnapshot,
  CardCategorySnapshot,
} from '@kanban/contracts/board';
import {
  applyBoardChange,
  checkRevision,
  createBoardSync,
  type BoardChange,
  type BoardState,
} from './boardSync';

const card = (id: string, columnId: string, position: number): BoardCardSnapshot => ({
  id,
  columnId,
  title: id,
  description: null,
  categoryId: null,
  position,
  version: 1,
  createdAt: '2026-11-07T00:00:00.000Z',
  updatedAt: '2026-11-07T00:00:00.000Z',
});

const column = (id: string, position: number, cards: BoardCardSnapshot[] = []): BoardColumnSnapshot => ({
  id,
  title: id,
  colorKey: 'coral',
  position,
  cards,
});

const createState = (): BoardState => ({
  columns: [
    column('todo', 1024, [card('a', 'todo', 1024), card('b', 'todo', 2048)]),
    column('done', 2048, [card('c', 'done', 1024)]),
  ],
  categories: [{ id: 'cat-b', name: 'Backend', colorKey: 'mint' }],
});

const cardIds = (state: BoardState, columnId: string) =>
  state.columns.find((item) => item.id === columnId)!.cards.map((item) => item.id);

const moved = (target: BoardCardSnapshot, revision = '11'): BoardChange => ({
  kind: 'cardMoved',
  result: { card: target, boardRevision: revision },
});

describe('checkRevision', () => {
  it('剛好 +1 為 next、小於或等於為 stale、跳號為 gap', () => {
    expect(checkRevision('10', '11')).toBe('next');
    expect(checkRevision('10', '10')).toBe('stale');
    expect(checkRevision('10', '9')).toBe('stale');
    expect(checkRevision('10', '12')).toBe('gap');
  });

  it('以數值比較，不是字串比較', () => {
    expect(checkRevision('9', '10')).toBe('next');
  });

  it('還沒有快照（revision 為 null）時一律視為 gap', () => {
    expect(checkRevision(null, '1')).toBe('gap');
  });
});

describe('applyBoardChange', () => {
  it('新增卡片依 position 插入目標欄位', () => {
    const state = createState();

    applyBoardChange(state, {
      kind: 'cardCreated',
      result: { card: card('n', 'todo', 1536), boardRevision: '11' },
    });

    expect(cardIds(state, 'todo')).toEqual(['a', 'n', 'b']);
  });

  it('編輯卡片時以新內容取代，位置不變', () => {
    const state = createState();

    applyBoardChange(state, {
      kind: 'cardUpdated',
      result: { card: { ...card('a', 'todo', 1024), title: '新標題', version: 2 }, boardRevision: '11' },
    });

    expect(cardIds(state, 'todo')).toEqual(['a', 'b']);
    expect(state.columns[0]!.cards[0]!.title).toBe('新標題');
  });

  it('跨欄移動：從原欄位移除，依 position 放進目標欄位', () => {
    const state = createState();

    expect(applyBoardChange(state, moved(card('a', 'done', 2048)))).toBe(true);

    expect(cardIds(state, 'todo')).toEqual(['b']);
    expect(cardIds(state, 'done')).toEqual(['c', 'a']);
  });

  it('同欄移動到最上面', () => {
    const state = createState();

    applyBoardChange(state, moved(card('b', 'todo', 512)));

    expect(cardIds(state, 'todo')).toEqual(['b', 'a']);
  });

  it('自己已在本地放好的卡片，套用回應後不會重複', () => {
    const state = createState();
    // The drag library already moved "a" into "done" locally, still with its old values.
    state.columns[0]!.cards.splice(0, 1);
    state.columns[1]!.cards.push(card('a', 'todo', 1024));

    applyBoardChange(state, moved(card('a', 'done', 2048)));

    expect(cardIds(state, 'done')).toEqual(['c', 'a']);
    expect(state.columns[1]!.cards[1]!.columnId).toBe('done');
  });

  it('目標欄位有相鄰 position 差距 ≤ 1 時（可能已重新編號）回傳 false，不套用', () => {
    const state = createState();
    state.columns[1]!.cards.push(card('d', 'done', 1025));

    expect(applyBoardChange(state, moved(card('a', 'done', 5000)))).toBe(false);
    expect(cardIds(state, 'todo')).toEqual(['a', 'b']);
  });

  it('目標欄位不在看板上時回傳 false', () => {
    const state = createState();

    expect(applyBoardChange(state, moved(card('a', 'missing', 1024)))).toBe(false);
  });

  it('封存卡片：從所在欄位移除', () => {
    const state = createState();

    applyBoardChange(state, {
      kind: 'cardArchived',
      result: { cardId: 'b', columnId: 'todo', boardRevision: '11' },
    });

    expect(cardIds(state, 'todo')).toEqual(['a']);
  });

  it('新增欄位依 position 排序，重複收到不會重複加入', () => {
    const state = createState();
    const change: BoardChange = {
      kind: 'columnCreated',
      result: { column: column('doing', 1536), boardRevision: '11' },
    };

    applyBoardChange(state, change);
    applyBoardChange(state, change);

    expect(state.columns.map((item) => item.id)).toEqual(['todo', 'doing', 'done']);
  });

  it('新增類別依名稱排序（不分大小寫），重複收到不會重複加入', () => {
    const state = createState();
    const category: CardCategorySnapshot = { id: 'cat-a', name: 'api', colorKey: 'coral' };
    const change: BoardChange = { kind: 'categoryCreated', result: { category, boardRevision: '11' } };

    applyBoardChange(state, change);
    applyBoardChange(state, change);

    expect(state.categories.map((item) => item.id)).toEqual(['cat-a', 'cat-b']);
  });

  it('移動欄位暫時不套用（回傳 false 讓看板重新載入），也不改動畫面；D-2 改為依回傳順序重排', () => {
    const state = createState();
    const before = state.columns.map((item) => item.id);
    const change: BoardChange = {
      kind: 'columnMoved',
      result: {
        columns: [...state.columns].reverse().map(({ id }, index) => ({ id, position: (index + 1) * 1024 })),
        boardRevision: '11',
      },
    };

    expect(applyBoardChange(state, change)).toBe(false);
    expect(state.columns.map((item) => item.id)).toEqual(before);
  });
});

describe('createBoardSync', () => {
  const setup = (revision: string | null = '10', projectId = 'p1') => {
    const state = { revision };
    const apply = vi.fn<(change: BoardChange) => boolean>(() => true);
    const reload = vi.fn<() => void>();
    const sync = createBoardSync({
      getProjectId: () => projectId,
      getRevision: () => state.revision,
      setRevision: (next) => {
        state.revision = next;
      },
      apply,
      reload,
    });
    return { sync, state, apply, reload };
  };

  const archived = (revision: string): BoardChange => ({
    kind: 'cardArchived',
    result: { cardId: 'x', columnId: 'todo', boardRevision: revision },
  });

  it('next：套用並更新 revision', () => {
    const { sync, state, apply } = setup();

    sync.receive('p1', archived('11'));

    expect(apply).toHaveBeenCalledTimes(1);
    expect(state.revision).toBe('11');
  });

  it('stale：自己的 HTTP 回應與廣播事件只套用先到的那一個', () => {
    const { sync, apply } = setup();

    sync.receive('p1', archived('11'));
    sync.receive('p1', archived('11'));

    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('gap：不套用，重新載入', () => {
    const { sync, state, apply, reload } = setup();

    sync.receive('p1', archived('12'));

    expect(apply).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(state.revision).toBe('10');
  });

  it('無法套用（apply 回傳 false）時重新載入，revision 不前進', () => {
    const { sync, state, apply, reload } = setup();
    apply.mockReturnValue(false);

    sync.receive('p1', archived('11'));

    expect(reload).toHaveBeenCalledTimes(1);
    expect(state.revision).toBe('10');
  });

  it('其他專案的事件直接忽略', () => {
    const { sync, apply, reload } = setup();

    sync.receive('p2', archived('11'));

    expect(apply).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('載入期間暫存；載入完成後丟掉 ≤ 快照 revision 的，其餘依序套用（Q5）', () => {
    const { sync, state, apply, reload } = setup(null);
    sync.pause('loading');
    sync.receive('p1', archived('11'));
    sync.receive('p1', archived('13'));
    sync.receive('p1', archived('12'));

    state.revision = '11'; // snapshot arrived
    sync.resume('loading');

    expect(apply.mock.calls.map(([change]) => change.result.boardRevision)).toEqual(['12', '13']);
    expect(state.revision).toBe('13');
    expect(reload).not.toHaveBeenCalled();
  });

  it('拖曳期間暫存，放開並存檔後才套用（Q6）', () => {
    const { sync, apply } = setup();
    sync.pause('dragging');
    sync.receive('p1', archived('11'));

    expect(apply).not.toHaveBeenCalled();

    sync.resume('dragging');
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('拖曳期間需要重新載入時，等放開後才載入', () => {
    const { sync, reload } = setup();
    sync.pause('dragging');
    sync.receive('p1', archived('12'));
    sync.resume('dragging');

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('重放佇列時遇到 gap 會重新載入，剩下的留在佇列等下一次快照', () => {
    const { sync, state, apply, reload } = setup();
    reload.mockImplementation(() => sync.pause('loading'));
    sync.pause('dragging');
    sync.receive('p1', archived('12'));
    sync.receive('p1', archived('13'));

    sync.resume('dragging');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(apply).not.toHaveBeenCalled();

    state.revision = '12';
    sync.resume('loading');
    expect(apply).toHaveBeenCalledTimes(1);
    expect(state.revision).toBe('13');
  });

  it('clear 會丟掉佇列，避免載入失敗後一直重新載入', () => {
    const { sync, apply, reload } = setup();
    sync.pause('loading');
    sync.receive('p1', archived('15'));

    sync.clear();
    sync.resume('loading');

    expect(apply).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
