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
});

export type Env = z.infer<typeof envSchema>;
