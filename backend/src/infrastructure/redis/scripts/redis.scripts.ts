import { SESSION_SCRIPTS } from '@/modules/session/session.script';
import { LOCK_SCRIPTS } from './redisLock.script';
import { RATE_LIMIT_SCRIPTS } from './rateLimit.script';
export const REDIS_SCRIPTS = {
  ...SESSION_SCRIPTS,
  ...LOCK_SCRIPTS,
  ...RATE_LIMIT_SCRIPTS,
};
export type RedisScripts = typeof REDIS_SCRIPTS;
