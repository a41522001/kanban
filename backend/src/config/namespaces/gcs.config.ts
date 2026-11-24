import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from '../env';

/** 本機開發連 GCS 用的服務帳號帳密；未設定時使用預設身分（正式環境為 VM 附加的服務帳號）。 */
export const gcsConfig = registerAs('gcs', () => {
  const env = getValidatedEnv();
  return {
    clientEmail: env.GCS_CLIENT_EMAIL,
    privateKey: env.GCS_PRIVATE_KEY,
  };
});
