import type { BoardColumnSnapshot } from '@kanban/contracts/board';

/**
 * The column right before the given one, or null when it is first (Board spec §8.3).
 * Returns undefined when the column is not on the board. The backend computes position from
 * this id, so the frontend never sends positions.
 */
export const getAfterColumnId = (
  columns: BoardColumnSnapshot[],
  columnId: string,
): string | null | undefined => {
  const index = columns.findIndex((column) => column.id === columnId);
  if (index === -1) return undefined;
  return index === 0 ? null : columns[index - 1]!.id;
};
