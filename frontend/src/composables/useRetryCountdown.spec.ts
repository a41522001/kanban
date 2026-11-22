import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { formatCountdown, parseRetryAfterSeconds, useRetryCountdown } from './useRetryCountdown';

describe('parseRetryAfterSeconds', () => {
  it('讀出 429 data 的秒數', () => {
    expect(parseRetryAfterSeconds({ retryAfterSeconds: 420 })).toBe(420);
  });

  it.each([
    ['null', null],
    ['缺少欄位', {}],
    ['字串', { retryAfterSeconds: '420' }],
    ['0', { retryAfterSeconds: 0 }],
    ['負數', { retryAfterSeconds: -1 }],
    ['NaN', { retryAfterSeconds: Number.NaN }],
    ['Infinity', { retryAfterSeconds: Number.POSITIVE_INFINITY }],
  ])('%s 時回傳 null，讓呼叫端改用一般錯誤訊息', (_case, data) => {
    expect(parseRetryAfterSeconds(data)).toBeNull();
  });
});

describe('formatCountdown', () => {
  it.each([
    [0, '00:00'],
    [5, '00:05'],
    [420, '07:00'],
    [3600, '60:00'],
  ])('%d 秒顯示為 %s', (seconds, expected) => {
    expect(formatCountdown(seconds)).toBe(expected);
  });
});

describe('useRetryCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-11-19T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const create = () => {
    const scope = effectScope();
    const countdown = scope.run(() => useRetryCountdown())!;
    return { scope, countdown };
  };

  it('開始後逐秒倒數，歸零時解除', () => {
    // Arrange
    const { countdown } = create();

    // Act
    countdown.start(3);

    // Assert
    expect(countdown.isActive.value).toBe(true);
    expect(countdown.countdown.value).toBe('00:03');
    vi.advanceTimersByTime(2000);
    expect(countdown.countdown.value).toBe('00:01');
    vi.advanceTimersByTime(1000);
    expect(countdown.isActive.value).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('依截止時間計算：計時器被延遲（背景分頁）也不會多等', () => {
    // Arrange
    const { countdown } = create();
    countdown.start(60);

    // Act: the clock jumps ahead without the interval having fired in between.
    vi.setSystemTime(Date.now() + 59_000);
    vi.advanceTimersByTime(1000);

    // Assert
    expect(countdown.isActive.value).toBe(false);
  });

  it('再次開始時以新的秒數重新計算，不留下舊的計時器', () => {
    // Arrange
    const { countdown } = create();
    countdown.start(10);

    // Act
    countdown.start(120);

    // Assert
    expect(countdown.countdown.value).toBe('02:00');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('元件卸載（scope 結束）時清除計時器', () => {
    // Arrange
    const { scope, countdown } = create();
    countdown.start(60);

    // Act
    scope.stop();

    // Assert
    expect(vi.getTimerCount()).toBe(0);
  });
});
