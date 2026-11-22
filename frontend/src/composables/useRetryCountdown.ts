import { computed, onScopeDispose, ref } from 'vue';

/**
 * Reads `retryAfterSeconds` from a 429 response body (`AuthRateLimitedData`).
 * Returns null for anything unusable, so the caller can fall back to a plain message.
 */
export const parseRetryAfterSeconds = (data: unknown): number | null => {
  if (
    typeof data === 'object' &&
    data !== null &&
    'retryAfterSeconds' in data &&
    typeof data.retryAfterSeconds === 'number' &&
    Number.isFinite(data.retryAfterSeconds) &&
    data.retryAfterSeconds > 0
  ) {
    return Math.ceil(data.retryAfterSeconds);
  }
  return null;
};

/** Formats seconds as MM:SS (the signup window of one hour reads 60:00). */
export const formatCountdown = (seconds: number): string => {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

/**
 * Countdown until the server allows another attempt.
 * It stores a deadline instead of decrementing a counter, so a throttled background tab
 * still unlocks on time. The timer only runs while counting and stops with the component.
 */
export const useRetryCountdown = () => {
  const retryAt = ref(0);
  const now = ref(Date.now());
  let timer: ReturnType<typeof setInterval> | undefined;

  const secondsLeft = computed(() => Math.max(0, Math.ceil((retryAt.value - now.value) / 1000)));
  const isActive = computed(() => secondsLeft.value > 0);
  const countdown = computed(() => formatCountdown(secondsLeft.value));

  const stop = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    retryAt.value = 0;
  };

  const tick = () => {
    now.value = Date.now();
    if (!isActive.value) stop();
  };

  const start = (seconds: number) => {
    stop();
    now.value = Date.now();
    retryAt.value = now.value + seconds * 1000;
    timer = setInterval(tick, 1000);
  };

  onScopeDispose(stop);

  return { secondsLeft, isActive, countdown, start, stop };
};
