import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from '../env';

export const mailConfig = registerAs('mail', () => {
  const env = getValidatedEnv();
  return {
    transport: env.EMAIL_TRANSPORT,
    smtpHost: env.SMTP_HOST,
    smtpPort: env.SMTP_PORT,
    smtpUser: env.SMTP_USER,
    smtpPassword: env.SMTP_PASSWORD,
    from: env.MAIL_FROM,
  };
});
