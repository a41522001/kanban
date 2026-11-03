import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from '../env';

export const avatarConfig = registerAs('avatar', () => {
  const env = getValidatedEnv();
  return {
    storageRoot: env.AVATAR_STORAGE_ROOT,
    tempRoot: env.AVATAR_TEMP_ROOT,
    publicBaseUrl: env.AVATAR_PUBLIC_BASE_URL,
  };
});
