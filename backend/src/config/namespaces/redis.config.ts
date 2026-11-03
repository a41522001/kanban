import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from '../env';

export const redisConfig = registerAs('redis', () => {
  const env = getValidatedEnv();
  return {
    url: env.REDIS_URL,
  };
});
