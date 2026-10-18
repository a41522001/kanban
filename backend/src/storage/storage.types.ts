/** listDirs 回傳的單一目錄資訊。 */
export interface StoredDir {
  /** 目錄名稱（不含前綴），Avatar 為 uploadId。 */
  name: string;
  /** 最後修改時間；孤兒清理依此判斷寬限期。 */
  modifiedAt: Date;
}

/**
 * 檔案儲存抽象；Local 與未來的 S3 實作共用此介面。
 * key 一律由 server 產生，例如 `avatars/<uploadId>/md.webp`。
 */
export interface StorageService {
  /** 原子寫入：先寫暫存檔再 rename，不得公開半份檔案。 */
  write(key: string, body: Buffer, contentType: string): Promise<void>;
  /** 讀取檔案；不存在時回傳 null。 */
  read(key: string): Promise<Buffer | null>;
  /** 刪除前綴底下的所有檔案；不存在視為成功。 */
  deleteDir(prefix: string): Promise<void>;
  /** 列出前綴底下的第一層目錄。 */
  listDirs(prefix: string): Promise<StoredDir[]>;
  /** 回傳瀏覽器可讀取的 URL；私有儲存（temp）呼叫時應丟錯。 */
  getPublicUrl(key: string): string;
}
