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

  async write(key: string, body: Buffer, contentType: string): Promise<void> {
    this.assertValidKey(key);
    const { cacheControl } = this.options;
    const file = this.bucket.file(key);
    await file.save(body, {
      contentType,
      resumable: false,
      metadata: cacheControl === null ? undefined : { cacheControl },
    });
  }

  async read(key: string): Promise<Buffer | null> {
    this.assertValidKey(key);
    const file = this.bucket.file(key);
    try {
      const [content] = await file.download();
      return content;
    } catch (error) {
      if (error instanceof ApiError && error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  async deleteDir(prefix: string): Promise<void> {
    this.assertValidPrefix(prefix);
    const [files] = await this.bucket.getFiles({ prefix });
    const response = files.map((file) => file.delete({ ignoreNotFound: true }));
    await Promise.all(response);
  }

  listDirs(_prefix: string): Promise<StoredDir[]> {
    throw new NotImplementedException();
  }

  /**
   * 組出瀏覽器可讀取的公開網址。
   *
   * @returns `${publicBaseUrl}/${key}`。
   * @param key 物件 key，例如 `avatars/<uploadId>/md.webp`。
   * @throws {Error} 私有儲存（publicBaseUrl 為 null）不提供公開網址，或 key 格式錯誤。
   */
  getPublicUrl(key: string): string {
    if (this.options.publicBaseUrl === null) {
      throw new Error('此 storage 不提供公開網址');
    }
    this.assertValidKey(key);
    // 去掉 base URL 結尾的 '/'，避免設定多寫斜線時產生 '//'
    const baseUrl = this.options.publicBaseUrl.replace(/\/+$/, '');
    return `${baseUrl}/${key}`;
  }

  /**
   * 檢查檔案 key，例如 `avatars/<uploadId>/md.webp`。
   * @throws {Error} key 為空、以 / 開頭或結尾，或某一段是 `..`。
   */
  private assertValidKey(key: string): void {
    if (key === '' || key.startsWith('/') || key.endsWith('/')) {
      throw new Error(`Storage key 格式錯誤：${key}`);
    }
    // 用 / 切成一段一段，只擋「整段剛好是 ..」的情況
    if (key.split('/').includes('..')) {
      throw new Error(`Storage key 不可包含 ..：${key}`);
    }
  }

  /**
   * 檢查資料夾前綴，例如 `avatars/<uploadId>/`。
   * 空字串或 `/` 等於整個 bucket，必須擋下，避免 deleteDir 刪光所有檔案。
   * @throws {Error} prefix 沒有以 / 結尾，或只有 `/`。
   */
  private assertValidPrefix(prefix: string): void {
    if (prefix === '/' || !prefix.endsWith('/')) {
      throw new Error(`Storage prefix 必須以 / 結尾：${prefix}`);
    }
  }
}
