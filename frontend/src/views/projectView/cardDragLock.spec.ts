import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CARD_DRAG_LOCK_TTL_MS } from '@kanban/contracts/socket';
import { createRemoteCardDragLocks, resolveCardDrop } from './cardDragLock';

describe('createRemoteCardDragLocks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('收到開始後鎖住，收到結束後解除', () => {
    const locks = createRemoteCardDragLocks();

    locks.lock('card-1');
    expect(locks.isLocked('card-1')).toBe(true);
    expect(locks.isLocked('card-2')).toBe(false);

    locks.release('card-1');
    expect(locks.isLocked('card-1')).toBe(false);
  });

  it('沒有收到結束時，TTL 到期自動解除（鎖過期時伺服器不廣播）', () => {
    const locks = createRemoteCardDragLocks();
    locks.lock('card-1');

    vi.advanceTimersByTime(CARD_DRAG_LOCK_TTL_MS - 1);
    expect(locks.isLocked('card-1')).toBe(true);

    vi.advanceTimersByTime(1);
    expect(locks.isLocked('card-1')).toBe(false);
  });

  it('同一張卡片再次開始時重新計時', () => {
    const locks = createRemoteCardDragLocks(1000);
    locks.lock('card-1');
    vi.advanceTimersByTime(800);

    locks.lock('card-1');
    vi.advanceTimersByTime(800);

    expect(locks.isLocked('card-1')).toBe(true);
    vi.advanceTimersByTime(200);
    expect(locks.isLocked('card-1')).toBe(false);
  });

  it('解除後舊的計時器不會影響之後再鎖住的同一張卡片', () => {
    const locks = createRemoteCardDragLocks(1000);
    locks.lock('card-1');
    vi.advanceTimersByTime(600);
    locks.release('card-1');

    locks.lock('card-1');
    vi.advanceTimersByTime(600);

    expect(locks.isLocked('card-1')).toBe(true);
  });

  it('clear 解除全部並停止計時', () => {
    const locks = createRemoteCardDragLocks();
    locks.lock('card-1');
    locks.lock('card-2');

    locks.clear();

    expect(locks.isLocked('card-1')).toBe(false);
    expect(locks.isLocked('card-2')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('resolveCardDrop', () => {
  it('locked 且有移動：不存檔、重新載入恢復原位、不送 dragEnd', () => {
    expect(resolveCardDrop('locked', true)).toEqual({
      save: false,
      restore: true,
      sendDragEnd: false,
    });
  });

  it('locked 但放回原位：什麼都不做', () => {
    expect(resolveCardDrop('locked', false)).toEqual({
      save: false,
      restore: false,
      sendDragEnd: false,
    });
  });

  it.each(['acquired', 'unavailable'] as const)(
    '%s 且有移動：存檔並送 dragEnd（unavailable 放行，Q10）',
    (status) => {
      expect(resolveCardDrop(status, true)).toEqual({
        save: true,
        restore: false,
        sendDragEnd: true,
      });
    },
  );

  it.each(['acquired', 'unavailable'] as const)(
    '%s 但放回原位：不存檔，仍送 dragEnd 釋放鎖',
    (status) => {
      expect(resolveCardDrop(status, false)).toEqual({
        save: false,
        restore: false,
        sendDragEnd: true,
      });
    },
  );
});
