import { envSchema } from './env';

// 必填欄位的最小集合；值一律是字串，模擬 .env 或 Docker 傳入的原始內容。
const baseEnv: Record<string, string> = {
  NODE_ENV: 'development',
  FRONTEND_URL: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/kanban',
  REDIS_URL: 'redis://localhost:6379',
  EMAIL_TRANSPORT: 'smtp',
  SMTP_USER: 'mailer@example.com',
  SMTP_PASSWORD: 'secret',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '465',
  MAIL_FROM: 'Flowboard <mailer@example.com>',
};

const gcsBuckets = {
  AVATAR_STORAGE_DRIVER: 'gcs',
  AVATAR_MEDIA_BUCKET: 'flowboard-dev-avatar-media',
  AVATAR_TEMP_BUCKET: 'flowboard-dev-avatar-temp',
};

const gcsCredentials = {
  GCS_CLIENT_EMAIL: 'kanban-dev@project.iam.gserviceaccount.com',
  GCS_PRIVATE_KEY:
    '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
};

/** 回傳驗證失敗的欄位路徑；通過時為空陣列。 */
const issuePaths = (env: Record<string, string>): string[] => {
  const result = envSchema.safeParse({ ...baseEnv, ...env });
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join('.'));
};

describe('envSchema', () => {
  describe('avatar 儲存設定', () => {
    it('未設定 AVATAR_STORAGE_DRIVER 時預設為 local', () => {
      // Act
      const env = envSchema.parse(baseEnv);

      // Assert
      expect(env.AVATAR_STORAGE_DRIVER).toBe('local');
    });

    it('GCS_PRIVATE_KEY 中的 \\n 字串應轉成真正的換行', () => {
      // Act
      const env = envSchema.parse({ ...baseEnv, ...gcsCredentials });

      // Assert
      expect(env.GCS_PRIVATE_KEY).toBe(
        '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
      );
    });

    it.each(['AVATAR_MEDIA_BUCKET', 'GCS_CLIENT_EMAIL', 'GCS_PRIVATE_KEY'])(
      '%s 為空字串（.env 寫成 KEY=）時應驗證失敗，未使用的變數要整行註解',
      (key) => {
        // Act & Assert
        expect(issuePaths({ [key]: '' })).toContain(key);
      },
    );
  });

  describe('規則 1：正式環境禁止 local', () => {
    it('NODE_ENV=production 且 driver 為 local 時應擋下', () => {
      // Act & Assert
      expect(issuePaths({ NODE_ENV: 'production' })).toEqual([
        'AVATAR_STORAGE_DRIVER',
      ]);
    });

    it('NODE_ENV=production 且 driver 為 gcs（含 bucket）時應通過', () => {
      // Act & Assert
      expect(issuePaths({ NODE_ENV: 'production', ...gcsBuckets })).toEqual([]);
    });

    it.each(['development', 'test'])(
      'NODE_ENV=%s 使用 local 應通過',
      (nodeEnv) => {
        // Act & Assert
        expect(issuePaths({ NODE_ENV: nodeEnv })).toEqual([]);
      },
    );
  });

  describe('規則 2：gcs 模式的 bucket 名稱', () => {
    it.each(['AVATAR_MEDIA_BUCKET', 'AVATAR_TEMP_BUCKET'])(
      '缺少 %s 時應擋下',
      (key) => {
        // Arrange
        const env: Record<string, string> = { ...gcsBuckets };
        delete env[key];

        // Act & Assert
        expect(issuePaths(env)).toEqual(['AVATAR_MEDIA_BUCKET']);
      },
    );

    it('兩個 bucket 都沒設定時只回報一筆「必須設定」，不再誤報「不可相同」', () => {
      // Act & Assert
      expect(issuePaths({ AVATAR_STORAGE_DRIVER: 'gcs' })).toEqual([
        'AVATAR_MEDIA_BUCKET',
      ]);
    });

    it('兩個 bucket 名稱相同時應擋下', () => {
      // Act & Assert
      expect(
        issuePaths({
          ...gcsBuckets,
          AVATAR_TEMP_BUCKET: gcsBuckets.AVATAR_MEDIA_BUCKET,
        }),
      ).toEqual(['AVATAR_TEMP_BUCKET']);
    });

    it('gcs 模式設定兩個不同的 bucket 時應通過', () => {
      // Act & Assert
      expect(issuePaths(gcsBuckets)).toEqual([]);
    });

    it('local 模式不需要 bucket 名稱', () => {
      // Act & Assert
      expect(issuePaths({ AVATAR_STORAGE_DRIVER: 'local' })).toEqual([]);
    });
  });

  describe('規則 3：GCS 帳密必須成對', () => {
    it.each([
      [
        '只設定 GCS_CLIENT_EMAIL',
        { GCS_CLIENT_EMAIL: gcsCredentials.GCS_CLIENT_EMAIL },
      ],
      [
        '只設定 GCS_PRIVATE_KEY',
        { GCS_PRIVATE_KEY: gcsCredentials.GCS_PRIVATE_KEY },
      ],
    ])('%s 時應擋下', (_label, env: Record<string, string>) => {
      // Act & Assert
      expect(issuePaths(env)).toEqual(['GCS_PRIVATE_KEY']);
    });

    it('兩個都設定時應通過', () => {
      // Act & Assert
      expect(issuePaths(gcsCredentials)).toEqual([]);
    });

    it('兩個都不設定時應通過', () => {
      // Act & Assert
      expect(issuePaths({})).toEqual([]);
    });
  });

  describe('規則 4：正式環境禁止 GCS 帳密', () => {
    it('NODE_ENV=production 且設定 GCS 帳密時應擋下', () => {
      // Act & Assert
      expect(
        issuePaths({
          NODE_ENV: 'production',
          ...gcsBuckets,
          ...gcsCredentials,
        }),
      ).toEqual(['GCS_CLIENT_EMAIL']);
    });

    it('NODE_ENV=production 只設定其中一個時，規則 3 與規則 4 都應回報', () => {
      // Act & Assert
      expect(
        issuePaths({
          NODE_ENV: 'production',
          ...gcsBuckets,
          GCS_CLIENT_EMAIL: gcsCredentials.GCS_CLIENT_EMAIL,
        }),
      ).toEqual(['GCS_PRIVATE_KEY', 'GCS_CLIENT_EMAIL']);
    });

    it('開發環境設定 GCS 帳密時應通過', () => {
      // Act & Assert
      expect(issuePaths({ ...gcsBuckets, ...gcsCredentials })).toEqual([]);
    });
  });
});
