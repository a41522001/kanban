import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import type { AppConfig } from '@/config';
import { LocalStorageService } from './localStorage.service';
import { MEDIA_STORAGE, TEMP_STORAGE } from './storage.tokens';

@Module({
  providers: [
    {
      provide: MEDIA_STORAGE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) =>
        new LocalStorageService(
          resolve(configService.get('avatar.storageRoot', { infer: true })),
          configService.get('avatar.publicBaseUrl', { infer: true }),
        ),
    },
    {
      provide: TEMP_STORAGE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) =>
        new LocalStorageService(
          resolve(configService.get('avatar.tempRoot', { infer: true })),
          null,
        ),
    },
  ],
  exports: [MEDIA_STORAGE, TEMP_STORAGE],
})
export class StorageModule {}
