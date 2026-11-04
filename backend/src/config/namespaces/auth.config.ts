import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from '../env';

/** 密碼雜湊與註冊驗證流程的規則；寄信方式見 mail namespace。 */
export const authConfig = registerAs('auth', () => {
  const env = getValidatedEnv();
  return {
    saltRounds: env.SALT_ROUNDS,
    verifyMailExpireMinute: env.VERIFY_MAIL_EXPIRE_MINUTE,
    rateLimitVerifyEmailSeconds: env.RATE_LIMIT_VERIFY_EMAIL_SECONDS,
  };
});
