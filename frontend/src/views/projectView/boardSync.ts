import type {
  AddCategoryResult,
  AddColumnResult,
  ArchiveCardResult,
  BoardCardSnapshot,
  BoardColumnSnapshot,
  CardCategorySnapshot,
  CardMutationResult,
  MoveColumnResult,
} from '@kanban/contracts/board';

/**
 * A change to apply to the board, from a Socket event or from our own HTTP response
 * (Board spec §7.2–7.3). One kind per event that bumps boardRevision.
 */
export type BoardChange =
  | { kind: 'columnCreated'; result: AddColumnResult }
  | { kind: 'cardCreated' | 'cardUpdated' | 'cardMoved'; result: CardMutationResult }
  | { kind: 'cardArchived'; result: ArchiveCardResult }
  | { kind: 'categoryCreated'; result: AddCategoryResult }
  | { kind: 'columnMoved'; result: MoveColumnResult };

export interface BoardState {
  columns: BoardColumnSnapshot[];
  categories: CardCategorySnapshot[];
}

/**
 * stale: already applied (ours or a duplicate); next: exactly one ahead, apply it;
 * gap: at least one change was missed, reload the board.
 */
export type RevisionCheck = 'stale' | 'next' | 'gap';

export const checkRevision = (current: string | null, incoming: string): RevisionCheck => {
  if (current === null) return 'gap';
  const diff = BigInt(incoming) - BigInt(current);
  if (diff <= 0n) return 'stale';
  return diff === 1n ? 'next' : 'gap';
};

const byPosition = (a: { position: number; id: string }, b: { position: number; id: string }) =>
  a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const removeCard = (columns: BoardColumnSnapshot[], cardId: string) => {
  for (const column of columns) {
    const index = column.cards.findIndex((card) => card.id === cardId);
    if (index !== -1) column.cards.splice(index, 1);
  }
};

/**
 * The backend renumbers a whole column when two neighbours leave no integer gap (spec §4.3),
 * but board:cardMoved only carries the moved card. If any neighbours here are that close,
 * the other cards' positions may now be stale, so the move cannot be placed reliably.
 */
const mayHaveBeenRenumbered = (column: BoardColumnSnapshot, movedCardId: string) => {
  const others = column.cards.filter((card) => card.id !== movedCardId);
  return others.some((card, index) => index > 0 && card.position - others[index - 1]!.position <= 1);
};

const insertCard = (column: BoardColumnSnapshot, card: BoardCardSnapshot) => {
  const index = column.cards.findIndex((item) => byPosition(card, item) < 0);
  if (index === -1) column.cards.push(card);
  else column.cards.splice(index, 0, card);
};

/**
 * Applies one change in place. Returns false when the board cannot apply it (for example
 * the target column is not on this board), so the caller reloads instead.
 */
export const applyBoardChange = (state: BoardState, change: BoardChange): boolean => {
  switch (change.kind) {
    case 'columnCreated': {
      const { column } = change.result;
      if (state.columns.some((item) => item.id === column.id)) return true;
      state.columns.push(column);
      state.columns.sort(byPosition);
      return true;
    }
    case 'cardCreated':
    case 'cardUpdated':
    case 'cardMoved': {
      // All three mean "put this card where its columnId and position say".
      const { card } = change.result;
      const target = state.columns.find((column) => column.id === card.columnId);
      if (!target) return false;
      if (change.kind === 'cardMoved' && mayHaveBeenRenumbered(target, card.id)) return false;
      removeCard(state.columns, card.id);
      insertCard(target, card);
      return true;
    }
    case 'cardArchived':
      removeCard(state.columns, change.result.cardId);
      return true;
    case 'categoryCreated': {
      const { category } = change.result;
      if (state.categories.some((item) => item.id === category.id)) return true;
      state.categories.push(category);
      state.categories.sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
      return true;
    }
    case 'columnMoved':
      // TODO(D-2): reorder columns from result.columns instead. Until then another member's
      // column move reloads the board (in the background, after any drag ends).
      return false;
  }
};

export type PauseReason = 'loading' | 'dragging';

interface QueuedChange {
  projectId: string;
  change: BoardChange;
}

export interface BoardSyncOptions {
  getProjectId: () => string;
  getRevision: () => string | null;
  setRevision: (revision: string) => void;
  apply: (change: BoardChange) => boolean;
  /** Reloads the whole board; expected to call pause('loading') before fetching. */
  reload: () => void;
}

/**
 * Orders board changes by boardRevision (Board spec §7.3):
 * - while loading or dragging, changes wait in a queue (Q5, Q6);
 * - on resume, the queue is replayed in revision order; anything at or below the
 *   snapshot's revision is dropped as stale;
 * - a gap, or a change that cannot be applied, reloads the whole board (Q9).
 */
export const createBoardSync = (options: BoardSyncOptions) => {
  const pauseReasons = new Set<PauseReason>();
  let queue: QueuedChange[] = [];
  let reloadPending = false;

  const isPaused = () => pauseReasons.size > 0;

  const requestReload = () => {
    // Replacing the columns mid-drag would break the drag library; reload once it ends.
    if (pauseReasons.has('dragging')) {
      reloadPending = true;
      return;
    }
    options.reload();
  };

  const process = ({ projectId, change }: QueuedChange) => {
    // A change from a project we already left (Board spec §7.2, BoardEvent.projectId).
    if (projectId !== options.getProjectId()) return;
    const revision = change.result.boardRevision;
    const check = checkRevision(options.getRevision(), revision);
    if (check === 'stale') return;
    if (check === 'gap' || !options.apply(change)) {
      requestReload();
      return;
    }
    options.setRevision(revision);
  };

  const flush = () => {
    queue.sort((a, b) => {
      const diff = BigInt(a.change.result.boardRevision) - BigInt(b.change.result.boardRevision);
      return diff < 0n ? -1 : diff > 0n ? 1 : 0;
    });
    // A reload started by process() pauses again; the rest stays queued for after it.
    while (queue.length > 0 && !isPaused()) {
      process(queue.shift()!);
    }
  };

  return {
    receive: (projectId: string, change: BoardChange) => {
      if (isPaused()) {
        queue.push({ projectId, change });
        return;
      }
      process({ projectId, change });
    },
    pause: (reason: PauseReason) => {
      pauseReasons.add(reason);
    },
    resume: (reason: PauseReason) => {
      pauseReasons.delete(reason);
      if (isPaused()) return;
      if (reloadPending) {
        reloadPending = false;
        options.reload();
        return;
      }
      flush();
    },
    /** Drops queued changes, e.g. after a failed load, so they do not trigger reload loops. */
    clear: () => {
      queue = [];
      reloadPending = false;
    },
  };
};

export type BoardSync = ReturnType<typeof createBoardSync>;
