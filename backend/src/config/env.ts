import { z } from 'zod';

export const envSchema = z
  .object({
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
    AVATAR_STORAGE_DRIVER: z.enum(['local', 'gcs']).default('local'),
    AVATAR_MEDIA_BUCKET: z.string().min(1).optional(),
    AVATAR_TEMP_BUCKET: z.string().min(1).optional(),
    GCS_CLIENT_EMAIL: z.email().optional(),
    GCS_PRIVATE_KEY: z
      .string()
      .min(1)
      .transform((v) => v.replace(/\\n/g, '\n'))
      .optional(),
    // 登入與註冊 rate limit（docs/features/rate-limit.md §2、§7）；MAX 為視窗內上限，WINDOW 為固定視窗秒數。
    RATE_LIMIT_LOGIN_EMAIL_IP_MAX: z.coerce
      .number()
      .int()
      .positive()
      .default(5),
    RATE_LIMIT_LOGIN_EMAIL_IP_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(900),
    RATE_LIMIT_LOGIN_IP_MAX: z.coerce.number().int().positive().default(50),
    RATE_LIMIT_LOGIN_IP_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(900),
    RATE_LIMIT_LOGIN_EMAIL_MAX: z.coerce.number().int().positive().default(100),
    RATE_LIMIT_LOGIN_EMAIL_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(3600),
    RATE_LIMIT_SIGNUP_IP_MAX: z.coerce.number().int().positive().default(20),
    RATE_LIMIT_SIGNUP_IP_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(3600),
    // Client 與 API 之間自己控制的 reverse proxy 層數，決定 req.ip 取 X-Forwarded-For 的哪一段（rate-limit.md §6）。
    // 預設 0（開發環境直連）；正式環境經 Nginx 設 1。設得比實際層數多，攻擊者就能以偽造的 header 繞過 IP 限制。
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((env, ctx) => {
    if (
      env.NODE_ENV === 'production' &&
      env.AVATAR_STORAGE_DRIVER === 'local'
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['AVATAR_STORAGE_DRIVER'],
        message: '正式環境必須使用 gcs：local 在正式環境沒有 /media 可讀取',
      });
    }

    if (env.AVATAR_STORAGE_DRIVER === 'gcs') {
      if (!env.AVATAR_MEDIA_BUCKET || !env.AVATAR_TEMP_BUCKET) {
        ctx.addIssue({
          code: 'custom',
          path: ['AVATAR_MEDIA_BUCKET'],
          message: 'gcs 模式必須設定兩個 bucket 名稱',
        });
      } else if (env.AVATAR_MEDIA_BUCKET === env.AVATAR_TEMP_BUCKET) {
        ctx.addIssue({
          code: 'custom',
          path: ['AVATAR_TEMP_BUCKET'],
          message: '兩個 bucket 不可相同，否則原圖會變成公開的',
        });
      }
    }

    const hasClientEmail = env.GCS_CLIENT_EMAIL !== undefined;
    const hasPrivateKey = env.GCS_PRIVATE_KEY !== undefined;

    if (hasClientEmail !== hasPrivateKey) {
      ctx.addIssue({
        code: 'custom',
        path: ['GCS_PRIVATE_KEY'],
        message: 'GCS_CLIENT_EMAIL 與 GCS_PRIVATE_KEY 必須同時設定或同時不設定',
      });
    }

    if (env.NODE_ENV === 'production' && (hasClientEmail || hasPrivateKey)) {
      ctx.addIssue({
        code: 'custom',
        path: ['GCS_CLIENT_EMAIL'],
        message:
          '正式環境不可設定 GCS_CLIENT_EMAIL／GCS_PRIVATE_KEY：應使用 VM 附加的服務帳號',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * 以 envSchema 解析 process.env，取得轉型後的值（number、default、transform）。
 * namespace factory 只能透過這裡取值：process.env 內的數字是字串，且 Docker 預先放入的變數不會套用 zod transform。
 * 不快取：測試在案例之間修改 process.env 時，才不會讀到舊結果。
 */
export const getValidatedEnv = (): Env => envSchema.parse(process.env);
