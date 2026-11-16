import { NotImplementedException } from '@nestjs/common';
import { ApiError, type Bucket } from '@google-cloud/storage';
import type { StorageService, StoredDir } from './storage.types';
type GcsStorageOptions = {
  /** 公開網址前綴；temp 傳 null。 */
  publicBaseUrl: string | null;
  /** 寫入時附加的 Cache-Control；temp 傳 null。 */
  cacheControl: string | null;
};

/**
 * Google Cloud Storage 儲存。
 * 不使用 @Injectable()：由 StorageModule 以 factory 建立 media 與 temp 兩個實例。
 */
export class GcsStorageService implements StorageService {
  constructor(
    private readonly bucket: Bucket,
    private readonly options: GcsStorageOptions,
  ) {}

  async write(key: string, body: Buffer, _contentType: string): Promise<void> {}

  async read(key: string): Promise<Buffer | null> {
    this.bucket.file(key);
  }

  async deleteDir(prefix: string): Promise<void> {}

  listDirs(_prefix: string): Promise<StoredDir[]> {
    throw new NotImplementedException();
  }

  getPublicUrl(key: string): string {}
}
