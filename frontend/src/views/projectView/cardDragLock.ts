import { CARD_DRAG_LOCK_TTL_MS, type CardDragAckStatus } from '@kanban/contracts/socket';
import { reactive } from 'vue';

/**
 * Cards someone else is dragging right now (Board spec §8.2). Each entry clears itself after the
 * lock TTL, because the server sends no "ended" event when a lock simply expires.
 */
export const createRemoteCardDragLocks = (ttlMs: number = CARD_DRAG_LOCK_TTL_MS) => {
  const lockedCardIds = reactive(new Set<string>());
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const release = (cardId: string) => {
    clearTimeout(timers.get(cardId));
    timers.delete(cardId);
    lockedCardIds.delete(cardId);
  };

  /** A repeated start for the same card restarts its timer. */
  const lock = (cardId: string) => {
    clearTimeout(timers.get(cardId));
    timers.set(
      cardId,
      setTimeout(() => release(cardId), ttlMs),
    );
    lockedCardIds.add(cardId);
  };

  const clear = () => {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    lockedCardIds.clear();
  };

  const isLocked = (cardId: string) => lockedCardIds.has(cardId);

  return { lock, release, clear, isLocked };
};

export type CardDropAction = {
  /** Save the new position with moveCard. */
  save: boolean;
  /** Put the card back by reloading the board, and tell the user someone else is moving it. */
  restore: boolean;
  /** Send card:dragEnd so the lock we may hold is released. */
  sendDragEnd: boolean;
};

/**
 * What to do when the user drops a card, given the dragStart ack (Board spec §8.2 step 3).
 * Only an explicit `locked` blocks the save; `unavailable` (error, timeout, offline) lets it
 * through (Q10). dragEnd is still sent for `unavailable`: the server may have taken the lock
 * even though the ack never arrived.
 */
export const resolveCardDrop = (status: CardDragAckStatus, moved: boolean): CardDropAction => {
  if (status === 'locked') {
    return { save: false, restore: moved, sendDragEnd: false };
  }
  return { save: moved, restore: false, sendDragEnd: true };
};
