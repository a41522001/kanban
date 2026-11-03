import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from '../env';

export const appConfig = registerAs('app', () => {
  const env = getValidatedEnv();
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    frontendUrl: env.FRONTEND_URL,
  };
});
