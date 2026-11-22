import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from '../env';

export const avatarConfig = registerAs('avatar', () => {
  const env = getValidatedEnv();
  return {
    storageRoot: env.AVATAR_STORAGE_ROOT,
    tempRoot: env.AVATAR_TEMP_ROOT,
    publicBaseUrl: env.AVATAR_PUBLIC_BASE_URL,
    storageDriver: env.AVATAR_STORAGE_DRIVER,
    mediaBucket: env.AVATAR_MEDIA_BUCKET,
    tempBucket: env.AVATAR_TEMP_BUCKET,
  };
});
