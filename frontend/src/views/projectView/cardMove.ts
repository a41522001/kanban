import type { BoardCardSnapshot, BoardColumnSnapshot } from '@kanban/contracts/board';

export interface CardLocation {
  column: BoardColumnSnapshot;
  index: number;
}

/** Finds the column and index of a card in the local board state. */
export const findCardLocation = (
  columns: BoardColumnSnapshot[],
  cardId: string,
): CardLocation | null => {
  for (const column of columns) {
    const index = column.cards.findIndex((card) => card.id === cardId);
    if (index !== -1) return { column, index };
  }
  return null;
};

/**
 * The card right above the given index, or null at the top (Board spec §5.3).
 * The backend computes position from this id, so the frontend never sends positions.
 */
export const getAfterCardId = (column: BoardColumnSnapshot, index: number): string | null =>
  index === 0 ? null : (column.cards[index - 1]?.id ?? null);

/**
 * Moves a card to the bottom of another column in the local state (the "移動至…" menu).
 * Returns the new location, or null when the card or column is missing.
 */
export const moveCardToColumnEnd = (
  columns: BoardColumnSnapshot[],
  cardId: string,
  toColumnId: string,
): CardLocation | null => {
  const from = findCardLocation(columns, cardId);
  const toColumn = columns.find((column) => column.id === toColumnId);
  if (!from || !toColumn) return null;

  const [card] = from.column.cards.splice(from.index, 1) as [BoardCardSnapshot];
  toColumn.cards.push({ ...card, columnId: toColumnId });
  return { column: toColumn, index: toColumn.cards.length - 1 };
};
