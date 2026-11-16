import { SESSION_SCRIPTS } from '@/modules/session/session.script';
import { LOCK_SCRIPTS } from './redisLock.script';
export const REDIS_SCRIPTS = { ...SESSION_SCRIPTS, ...LOCK_SCRIPTS };
export type RedisScripts = typeof REDIS_SCRIPTS;
