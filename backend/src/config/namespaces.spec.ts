import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { envSchema } from './env';
import { type AppConfig, configNamespaces } from '.';
import { appConfig } from './namespaces/app.config';
import { authConfig } from './namespaces/auth.config';
import { avatarConfig } from './namespaces/avatar.config';
import { databaseConfig } from './namespaces/database.config';
import { loggerConfig } from './namespaces/logger.config';
import { mailConfig } from './namespaces/mail.config';
import { redisConfig } from './namespaces/redis.config';
import { sessionConfig } from './namespaces/session.config';

// process.env 的值一律是字串，模擬 .env 或 Docker 傳入的原始內容。
const baseEnv: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '4001',
  FRONTEND_URL: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/kanban',
  REDIS_URL: 'redis://localhost:6379',
  SALT_ROUNDS: '12',
  SESSION_EXPIRE_DAY: '7',
  SESSION_ROTATE_MINUTE: '15',
  MAX_DEVICE: '5',
  EMAIL_TRANSPORT: 'smtp',
  SMTP_USER: 'mailer@example.com',
  SMTP_PASSWORD: 'secret',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '465',
  MAIL_FROM: 'Flowboard <mailer@example.com>',
  VERIFY_MAIL_EXPIRE_MINUTE: '30',
  RATE_LIMIT_VERIFY_EMAIL_SECONDS: '60',
  AVATAR_STORAGE_ROOT: './storage/media',
  AVATAR_TEMP_ROOT: './storage/temp',
  AVATAR_PUBLIC_BASE_URL: 'http://localhost:4001/media',
  SEQ_URL: 'http://localhost:5341',
};

describe('config namespaces', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...baseEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('factory', () => {
    it('每個環境變數對應到正確的路徑，數字欄位為 number', () => {
      // Act & Assert
      expect(appConfig()).toEqual({
        nodeEnv: 'test',
        port: 4001,
        frontendUrl: 'http://localhost:5173',
      });
      expect(databaseConfig()).toEqual({
        url: 'postgresql://user:pass@localhost:5432/kanban',
      });
      expect(redisConfig()).toEqual({ url: 'redis://localhost:6379' });
      expect(sessionConfig()).toEqual({
        expireDay: 7,
        rotateMinute: 15,
        maxDevice: 5,
      });
      expect(authConfig()).toEqual({
        saltRounds: 12,
        verifyMailExpireMinute: 30,
        rateLimitVerifyEmailSeconds: 60,
      });
      expect(mailConfig()).toEqual({
        transport: 'smtp',
        smtpHost: 'smtp.example.com',
        smtpPort: 465,
        smtpUser: 'mailer@example.com',
        smtpPassword: 'secret',
        from: 'Flowboard <mailer@example.com>',
      });
      expect(avatarConfig()).toEqual({
        storageRoot: './storage/media',
        tempRoot: './storage/temp',
        publicBaseUrl: 'http://localhost:4001/media',
      });
      expect(loggerConfig()).toEqual({ seqUrl: 'http://localhost:5341' });
    });

    it('未設定的變數套用 envSchema 的預設值', () => {
      // Arrange
      delete process.env.SESSION_EXPIRE_DAY;
      delete process.env.SALT_ROUNDS;
      delete process.env.AVATAR_STORAGE_ROOT;

      // Act
      const session = sessionConfig();
      const auth = authConfig();
      const avatar = avatarConfig();

      // Assert
      expect(session.expireDay).toBe(7);
      expect(auth.saltRounds).toBe(10);
      expect(avatar.storageRoot).toBe('./storage/media');
    });

    it('選填的 SEQ_URL 未設定時 logger.seqUrl 為 undefined', () => {
      // Arrange
      delete process.env.SEQ_URL;

      // Act
      const logger = loggerConfig();

      // Assert
      expect(logger.seqUrl).toBeUndefined();
    });

    it('環境變數不合法時 factory 丟出錯誤', () => {
      // Arrange
      process.env.REDIS_URL = 'http://localhost:6379';

      // Act & Assert
      expect(() => redisConfig()).toThrow();
    });
  });

  describe('ConfigModule 載入後', () => {
    it('ConfigService 以點路徑讀到轉型後的值', async () => {
      // Arrange
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            ignoreEnvFile: true,
            validate: (config) => envSchema.parse(config),
            load: configNamespaces,
          }),
        ],
      }).compile();
      const configService =
        module.get<ConfigService<AppConfig, true>>(ConfigService);

      // Act
      const expireDay = configService.get('session.expireDay', {
        infer: true,
      });
      const mail = configService.get('mail', { infer: true });

      // Assert
      expect(expireDay).toBe(7);
      expect(mail.smtpPort).toBe(465);
      expect(configService.get('app.port', { infer: true })).toBe(4001);
    });
  });
});
