import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from '../env';

export const sessionConfig = registerAs('session', () => {
  const env = getValidatedEnv();
  return {
    expireDay: env.SESSION_EXPIRE_DAY,
    rotateMinute: env.SESSION_ROTATE_MINUTE,
    maxDevice: env.MAX_DEVICE,
  };
});
