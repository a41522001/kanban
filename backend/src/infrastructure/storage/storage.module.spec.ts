import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Bucket, Storage } from '@google-cloud/storage';
import { configNamespaces } from '@/config';
import { envSchema } from '@/config/env';
import { GcsStorageService } from './gcsStorage.service';
import { LocalStorageService } from './localStorage.service';
import { StorageModule } from './storage.module';
import { GCS_CLIENT, MEDIA_STORAGE, TEMP_STORAGE } from './storage.tokens';
import type { StorageService } from './storage.types';

// 保留真正的 Storage（建立時不連網路），只包一層 jest.fn 以記錄建構參數與次數。
jest.mock('@google-cloud/storage', () => {
  const actual = jest.requireActual<typeof import('@google-cloud/storage')>(
    '@google-cloud/storage',
  );
  return {
    ...actual,
    Storage: jest.fn(
      (...args: ConstructorParameters<typeof actual.Storage>) =>
        new actual.Storage(...args),
    ),
  };
});

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

const gcsEnv = {
  AVATAR_STORAGE_DRIVER: 'gcs',
  AVATAR_MEDIA_BUCKET: 'flowboard-dev-avatar-media',
  AVATAR_TEMP_BUCKET: 'flowboard-dev-avatar-temp',
  AVATAR_PUBLIC_BASE_URL:
    'https://storage.googleapis.com/flowboard-dev-avatar-media',
};

/** 測試中讀取 GcsStorageService 內部的 Bucket，確認 module 傳入的 bucket 名稱與 client。 */
const bucketOf = (service: StorageService): Bucket =>
  (service as unknown as { bucket: Bucket }).bucket;

describe('StorageModule', () => {
  const originalEnv = process.env;
  let module: TestingModule;

  const compile = async (env: Record<string, string>) => {
    process.env = { ...baseEnv, ...env };
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: (config) => envSchema.parse(config),
          load: configNamespaces,
        }),
        StorageModule,
      ],
    }).compile();
    return {
      media: module.get<StorageService>(MEDIA_STORAGE),
      temp: module.get<StorageService>(TEMP_STORAGE),
    };
  };

  beforeEach(() => {
    jest.mocked(Storage).mockClear();
  });

  afterEach(async () => {
    await module?.close();
    process.env = originalEnv;
  });

  describe('driver 為 local（預設）', () => {
    it('media 與 temp 都應使用 LocalStorageService', async () => {
      // Act
      const { media, temp } = await compile({});

      // Assert
      expect(media).toBeInstanceOf(LocalStorageService);
      expect(temp).toBeInstanceOf(LocalStorageService);
    });

    it('media 提供 /media 公開網址，temp 不提供', async () => {
      // Act
      const { media, temp } = await compile({});

      // Assert
      expect(media.getPublicUrl('avatars/upload-1/md.webp')).toBe(
        'http://localhost:4001/media/avatars/upload-1/md.webp',
      );
      expect(() => temp.getPublicUrl('avatars/upload-1/original')).toThrow();
    });
  });

  describe('driver 為 gcs', () => {
    it('media 與 temp 都應使用 GcsStorageService，並各自指向設定的 bucket', async () => {
      // Act
      const { media, temp } = await compile(gcsEnv);

      // Assert
      expect(media).toBeInstanceOf(GcsStorageService);
      expect(temp).toBeInstanceOf(GcsStorageService);
      expect(bucketOf(media).name).toBe('flowboard-dev-avatar-media');
      expect(bucketOf(temp).name).toBe('flowboard-dev-avatar-temp');
    });

    it('兩個 bucket 應共用同一個 Storage client（只建立一次）', async () => {
      // Act
      const { media, temp } = await compile(gcsEnv);

      // Assert
      const client = module.get<Storage>(GCS_CLIENT);
      expect(Storage).toHaveBeenCalledTimes(1);
      expect(bucketOf(media).storage).toBe(client);
      expect(bucketOf(temp).storage).toBe(client);
    });

    it('media 以 AVATAR_PUBLIC_BASE_URL 組出公開網址，temp 不提供', async () => {
      // Act
      const { media, temp } = await compile(gcsEnv);

      // Assert
      expect(media.getPublicUrl('avatars/upload-1/md.webp')).toBe(
        'https://storage.googleapis.com/flowboard-dev-avatar-media/avatars/upload-1/md.webp',
      );
      expect(() => temp.getPublicUrl('avatars/upload-1/original')).toThrow();
    });

    it('media 寫入時帶 immutable Cache-Control，temp 不帶 metadata', async () => {
      // Arrange
      const { media, temp } = await compile(gcsEnv);
      const mediaSave = jest.fn().mockResolvedValue(undefined);
      const tempSave = jest.fn().mockResolvedValue(undefined);
      jest
        .spyOn(bucketOf(media), 'file')
        .mockReturnValue({ save: mediaSave } as never);
      jest
        .spyOn(bucketOf(temp), 'file')
        .mockReturnValue({ save: tempSave } as never);

      // Act
      await media.write(
        'avatars/upload-1/md.webp',
        Buffer.from('x'),
        'image/webp',
      );
      await temp.write(
        'avatars/upload-1/original',
        Buffer.from('x'),
        'image/png',
      );

      // Assert
      expect(mediaSave).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          metadata: { cacheControl: 'public, max-age=31536000, immutable' },
        }),
      );
      expect(tempSave).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ metadata: undefined }),
      );
    });
  });

  describe('GCS client 的身分', () => {
    it('設定 GCS_CLIENT_EMAIL／GCS_PRIVATE_KEY 時應以 credentials 建立 client', async () => {
      // Act
      await compile({
        ...gcsEnv,
        GCS_CLIENT_EMAIL: 'kanban-dev@project.iam.gserviceaccount.com',
        GCS_PRIVATE_KEY:
          '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
      });

      // Assert
      expect(Storage).toHaveBeenCalledWith({
        credentials: {
          client_email: 'kanban-dev@project.iam.gserviceaccount.com',
          private_key:
            '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
        },
      });
    });

    it('沒有設定帳密時應使用預設身分（不傳任何參數）', async () => {
      // Act
      await compile(gcsEnv);

      // Assert
      expect(Storage).toHaveBeenCalledWith();
    });
  });
});
