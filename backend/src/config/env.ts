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
  // Avatar 公開圖片（sm/md/lg.webp）的根目錄；相對路徑以 backend 為基準。
  AVATAR_STORAGE_ROOT: z.string().min(1).default('./storage/media'),
  // Avatar 原圖暫存根目錄；永不公開，且不可與 AVATAR_STORAGE_ROOT 相同。
  AVATAR_TEMP_ROOT: z.string().min(1).default('./storage/temp'),
  // 瀏覽器讀取 Avatar 圖片的網址前綴，對應 media root。
  AVATAR_PUBLIC_BASE_URL: z.url().default('http://localhost:4001/media'),
  // 設定時 log 會同時送進 Seq；未設定則只輸出到終端機（E2E、CI、正式環境預設不設定）。
  SEQ_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;
