import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import type { Env } from '@/config/env';
import { LocalStorageService } from './localStorage.service';
import { MEDIA_STORAGE, TEMP_STORAGE } from './storage.tokens';

@Module({
  providers: [
    {
      provide: MEDIA_STORAGE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env>) =>
        new LocalStorageService(
          resolve(
            configService.getOrThrow('AVATAR_STORAGE_ROOT', { infer: true }),
          ),
          configService.getOrThrow('AVATAR_PUBLIC_BASE_URL', { infer: true }),
        ),
    },
    {
      provide: TEMP_STORAGE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env>) =>
        new LocalStorageService(
          resolve(
            configService.getOrThrow('AVATAR_TEMP_ROOT', { infer: true }),
          ),
          null,
        ),
    },
  ],
  exports: [MEDIA_STORAGE, TEMP_STORAGE],
})
export class StorageModule {}
