import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from '../env';

export const loggerConfig = registerAs('logger', () => {
  const env = getValidatedEnv();
  return {
    seqUrl: env.SEQ_URL,
  };
});
