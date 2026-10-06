import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_URL: z.string(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().startsWith('redis://'),
  SALT_ROUNDS: z.coerce.number().int().positive().default(10),
  SESSION_EXPIRE_DAY: z.coerce.number().int().positive().default(7),
  SESSION_ROTATE_MINUTE: z.coerce.number().int().positive().default(15),
  MAX_DEVICE: z.coerce.number().int().positive().default(5),
  EMAIL_TRANSPORT: z.string(),
  SMTP_USER: z.email(),
  SMTP_PASSWORD: z.string(),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().int().positive(),
  MAIL_FROM: z.string(),
  VERIFY_MAIL_EXPIRE_MINUTE: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_VERIFY_EMAIL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
});

export type Env = z.infer<typeof envSchema>;
