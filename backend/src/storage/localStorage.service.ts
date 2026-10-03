import { mkdir, rename, rm, writeFile, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { NotImplementedException } from '@nestjs/common';
import type { StorageService, StoredDir } from './storage.types';
/**
 * 本機檔案系統儲存。
 * 不使用 @Injectable()：由 StorageModule 以 factory 建立 media 與 temp 兩個實例。
 */
export class LocalStorageService implements StorageService {
  /**
   * @param root 儲存根目錄（已 resolve 的絕對路徑）。
   * @param publicBaseUrl 公開網址前綴；temp 儲存傳 null。
   */
  constructor(
    private readonly root: string,
    private readonly publicBaseUrl: string | null,
  ) {}

  /**
   * 把 storage key 轉成 root 底下的絕對路徑，並確認沒有跑出 root。
   * 所有方法都先經過這裡，作為防止路徑寫錯或被竄改的最後一道防線。
   *
   * @param key 相對於 root 的路徑，例如 `avatars/<uploadId>/md.webp`。
   * @returns root 底下的絕對路徑。
   * @throws {Error} key 為空字串，或解析後位於 root 之外。
   */
  private resolveKey(key: string): string {
    const fullPath = resolve(this.root, key);
    // 反推「從 root 到 fullPath」的相對路徑，用來判斷是否越界。
    const relativePath = relative(this.root, fullPath);

    // '' → 指向 root 本身；'..' 開頭 → 跑出 root；
    // 絕對路徑 → Windows 上 root 與目標位於不同磁碟。
    if (
      relativePath === '' ||
      relativePath.startsWith('..') ||
      isAbsolute(relativePath)
    ) {
      throw new Error(`Storage key 超出根目錄：${key}`);
    }
    return fullPath;
  }

  /**
   * 原子寫入：先寫 `<檔名>.part`，完成後 rename 成正式檔名。
   * 讀取端只會看到舊檔或完整新檔，不會讀到寫一半的內容；同一個 key 重寫會直接覆蓋。
   *
   * @param key 相對於 root 的檔案路徑。
   * @param body 檔案內容。
   * @param _contentType Local 實作不使用（讀取時依副檔名判斷類型），保留給 S3 設定 ContentType。
   * @throws {Error} key 越界，或檔案系統寫入失敗（原樣往外丟，由呼叫端決定如何回應）。
   */
  async write(key: string, body: Buffer, _contentType: string): Promise<void> {
    const fullPath = this.resolveKey(key);
    // 暫存檔與正式檔放在同一資料夾，rename 才是原子操作。
    const tmpPath = `${fullPath}.part`;

    await mkdir(dirname(fullPath), { recursive: true });

    try {
      await writeFile(tmpPath, body);
      await rename(tmpPath, fullPath);
    } catch (error) {
      // 清掉寫一半的暫存檔後，把原本的錯誤繼續往外丟。
      await rm(tmpPath, { force: true });
      throw error;
    }
  }

  /**
   * 讀取檔案內容。
   * Worker 依回傳值區分「原圖真的不見了」（null，不重試）與「暫時讀不到」（丟錯，交給 BullMQ 重試）。
   *
   * @param key 相對於 root 的檔案路徑。
   * @returns 檔案內容；檔案不存在時回傳 null。
   * @throws {Error} key 越界，或 ENOENT 以外的檔案系統錯誤（如 EACCES、EISDIR、EMFILE）。
   */
  async read(key: string): Promise<Buffer | null> {
    const fullPath = this.resolveKey(key);
    // 直接讀取而不先檢查是否存在，避免檢查與讀取之間檔案被刪掉的時間差。
    try {
      return await readFile(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * 遞迴刪除前綴底下的所有檔案與資料夾；不存在視為成功（冪等）。
   *
   * @param prefix 相對於 root 的資料夾路徑，例如 `avatars/<uploadId>`。
   * @throws {Error} prefix 為空字串或越界（避免誤刪整個 root），或檔案系統刪除失敗。
   */
  async deleteDir(prefix: string): Promise<void> {
    const fullPath = this.resolveKey(prefix);
    // recursive：允許刪除資料夾及其內容；force：路徑不存在時不報錯。
    await rm(fullPath, { force: true, recursive: true });
  }

  /**
   * 列出前綴底下的第一層資料夾。
   * 第 8 步（孤兒清理排程）才實作；見規格書 §6.2。
   */
  listDirs(_prefix: string): Promise<StoredDir[]> {
    throw new NotImplementedException();
  }

  /**
   * 組出瀏覽器可讀取的公開網址。
   *
   * @param key 相對於 root 的檔案路徑。
   * @returns `${publicBaseUrl}/${key}`。
   * @throws {Error} 私有儲存（publicBaseUrl 為 null）不提供公開網址，或 key 越界。
   */
  getPublicUrl(key: string): string {
    if (this.publicBaseUrl === null) {
      throw new Error('此 storage 不提供公開網址');
    }
    // 不讀寫檔案，但仍驗證 key，避免組出指向 root 外的網址。
    this.resolveKey(key);

    // 去掉 base URL 結尾的 '/'，避免設定多寫斜線時產生 '//'。
    const baseUrl = this.publicBaseUrl.replace(/\/+$/, '');
    return `${baseUrl}/${key}`;
  }
}
