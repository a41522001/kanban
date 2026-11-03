import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from '../env';

export const databaseConfig = registerAs('database', () => {
  const env = getValidatedEnv();
  return {
    url: env.DATABASE_URL,
  };
});
