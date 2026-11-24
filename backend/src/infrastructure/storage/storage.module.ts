import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import type { AppConfig } from '@/config';
import { LocalStorageService } from './localStorage.service';
import { MEDIA_STORAGE, TEMP_STORAGE, GCS_CLIENT } from './storage.tokens';
import { Storage } from '@google-cloud/storage';
import { GcsStorageService } from './gcsStorage.service';

/** 公開圖片每次上傳的網址都不同（uploadId），可以永久快取。 */
const MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable';

@Module({
  providers: [
    {
      provide: GCS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const { clientEmail, privateKey } = configService.get('gcs', {
          infer: true,
        });

        if (clientEmail !== undefined && privateKey !== undefined) {
          return new Storage({
            credentials: { client_email: clientEmail, private_key: privateKey },
          });
        }
        return new Storage();
      },
    },
    {
      provide: MEDIA_STORAGE,
      inject: [ConfigService, GCS_CLIENT],
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        storage: Storage,
      ) => {
        const avatar = configService.get('avatar', { infer: true });
        if (avatar.storageDriver === 'local') {
          return new LocalStorageService(
            resolve(avatar.storageRoot),
            avatar.publicBaseUrl,
          );
        }
        return new GcsStorageService(storage.bucket(avatar.mediaBucket!), {
          publicBaseUrl: avatar.publicBaseUrl,
          cacheControl: MEDIA_CACHE_CONTROL,
        });
      },
    },
    {
      provide: TEMP_STORAGE,
      inject: [ConfigService, GCS_CLIENT],
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        storage: Storage,
      ) => {
        const avatar = configService.get('avatar', { infer: true });
        if (avatar.storageDriver === 'local') {
          return new LocalStorageService(resolve(avatar.tempRoot), null);
        }
        return new GcsStorageService(storage.bucket(avatar.tempBucket!), {
          publicBaseUrl: null,
          cacheControl: null,
        });
      },
    },
  ],
  exports: [MEDIA_STORAGE, TEMP_STORAGE],
})
export class StorageModule {}
