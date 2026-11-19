import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from '../env';

/** 密碼雜湊、註冊驗證與登入／註冊限流的規則；寄信方式見 mail namespace。 */
export const authConfig = registerAs('auth', () => {
  const env = getValidatedEnv();
  return {
    saltRounds: env.SALT_ROUNDS,
    verifyMailExpireMinute: env.VERIFY_MAIL_EXPIRE_MINUTE,
    rateLimitVerifyEmailSeconds: env.RATE_LIMIT_VERIFY_EMAIL_SECONDS,
    rateLimit: {
      loginEmailIp: {
        max: env.RATE_LIMIT_LOGIN_EMAIL_IP_MAX,
        windowSeconds: env.RATE_LIMIT_LOGIN_EMAIL_IP_WINDOW_SECONDS,
      },
      loginIp: {
        max: env.RATE_LIMIT_LOGIN_IP_MAX,
        windowSeconds: env.RATE_LIMIT_LOGIN_IP_WINDOW_SECONDS,
      },
      loginEmail: {
        max: env.RATE_LIMIT_LOGIN_EMAIL_MAX,
        windowSeconds: env.RATE_LIMIT_LOGIN_EMAIL_WINDOW_SECONDS,
      },
      signupIp: {
        max: env.RATE_LIMIT_SIGNUP_IP_MAX,
        windowSeconds: env.RATE_LIMIT_SIGNUP_IP_WINDOW_SECONDS,
      },
    },
  };
});
