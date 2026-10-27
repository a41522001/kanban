import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { LocalStorageService } from './localStorage.service';

describe('LocalStorageService', () => {
  const publicBaseUrl = 'http://localhost:4001/media';
  // 每個測試使用獨立的臨時資料夾：sandbox 內含 root，root 外的檔案用來驗證不會越界。
  let sandbox: string;
  let root: string;
  let storage: LocalStorageService;

  beforeEach(async () => {
    sandbox = await mkdtemp(join(tmpdir(), 'kanban-storage-'));
    root = join(sandbox, 'root');
    await mkdir(root);
    storage = new LocalStorageService(root, publicBaseUrl);
  });

  afterEach(async () => {
    await rm(sandbox, { recursive: true, force: true });
  });

  describe('write', () => {
    it('應自動建立上層資料夾並寫入檔案內容', async () => {
      // Arrange
      const key = 'avatars/upload-1/md.webp';
      const body = Buffer.from('webp-bytes');

      // Act
      await storage.write(key, body, 'image/webp');

      // Assert
      await expect(readFile(join(root, key))).resolves.toEqual(body);
    });

    it('寫入完成後不應殘留 .part 暫存檔', async () => {
      // Arrange
      const key = 'avatars/upload-1/md.webp';

      // Act
      await storage.write(key, Buffer.from('webp-bytes'), 'image/webp');

      // Assert
      await expect(readdir(join(root, 'avatars/upload-1'))).resolves.toEqual([
        'md.webp',
      ]);
    });

    it('同一個 key 重複寫入時應覆蓋為最新內容', async () => {
      // Arrange
      const key = 'avatars/upload-1/md.webp';
      await storage.write(key, Buffer.from('old'), 'image/webp');

      // Act
      await storage.write(key, Buffer.from('new'), 'image/webp');

      // Assert
      await expect(readFile(join(root, key), 'utf8')).resolves.toBe('new');
    });

    it('rename 失敗時應清除 .part 並把錯誤往外丟', async () => {
      // Arrange：目標路徑是非空資料夾，rename 檔案到該路徑必定失敗。
      const key = 'avatars/upload-1/md.webp';
      await mkdir(join(root, key), { recursive: true });
      await writeFile(join(root, key, 'occupied'), 'x');

      // Act
      const act = storage.write(key, Buffer.from('webp-bytes'), 'image/webp');

      // Assert
      await expect(act).rejects.toThrow();
      await expect(readdir(join(root, 'avatars/upload-1'))).resolves.toEqual([
        'md.webp',
      ]);
    });

    it.each(['../outside.txt', '/etc/kanban-outside.txt', ''])(
      '超出 root 的 key（%j）應拒絕且不寫入任何檔案',
      async (key) => {
        // Act
        const act = storage.write(key, Buffer.from('x'), 'image/webp');

        // Assert
        await expect(act).rejects.toThrow('超出根目錄');
        await expect(readdir(sandbox)).resolves.toEqual(['root']);
        await expect(readdir(root)).resolves.toEqual([]);
      },
    );
  });

  describe('read', () => {
    it('應回傳已存在檔案的內容', async () => {
      // Arrange
      const key = 'avatars/upload-1/original';
      const body = Buffer.from('original-bytes');
      await mkdir(dirname(join(root, key)), { recursive: true });
      await writeFile(join(root, key), body);

      // Act
      const result = await storage.read(key);

      // Assert
      expect(result).toEqual(body);
    });

    it('檔案不存在時應回傳 null', async () => {
      // Act
      const result = await storage.read('avatars/missing/original');

      // Assert
      expect(result).toBeNull();
    });

    it('非 ENOENT 的錯誤（路徑是資料夾）應往外丟而不是回傳 null', async () => {
      // Arrange
      await mkdir(join(root, 'avatars/upload-1'), { recursive: true });

      // Act
      const act = storage.read('avatars/upload-1');

      // Assert
      await expect(act).rejects.toMatchObject({ code: 'EISDIR' });
    });

    it('超出 root 的 key 應拒絕', async () => {
      // Arrange
      await writeFile(join(sandbox, 'secret.txt'), 'secret');

      // Act
      const act = storage.read('../secret.txt');

      // Assert
      await expect(act).rejects.toThrow('超出根目錄');
    });
  });

  describe('deleteDir', () => {
    it('應遞迴刪除資料夾與其中所有檔案', async () => {
      // Arrange
      await storage.write(
        'avatars/upload-1/sm.webp',
        Buffer.from('s'),
        'image/webp',
      );
      await storage.write(
        'avatars/upload-1/md.webp',
        Buffer.from('m'),
        'image/webp',
      );

      // Act
      await storage.deleteDir('avatars/upload-1');

      // Assert
      await expect(readdir(join(root, 'avatars'))).resolves.toEqual([]);
    });

    it('只刪除指定前綴，不影響同層其他資料夾', async () => {
      // Arrange
      await storage.write(
        'avatars/upload-1/md.webp',
        Buffer.from('1'),
        'image/webp',
      );
      await storage.write(
        'avatars/upload-2/md.webp',
        Buffer.from('2'),
        'image/webp',
      );

      // Act
      await storage.deleteDir('avatars/upload-1');

      // Assert
      await expect(readdir(join(root, 'avatars'))).resolves.toEqual([
        'upload-2',
      ]);
    });

    it('資料夾不存在時不應報錯（冪等）', async () => {
      // Act
      const act = storage.deleteDir('avatars/missing');

      // Assert
      await expect(act).resolves.toBeUndefined();
    });

    it.each(['', '..', '../root'])(
      '空字串或越界前綴（%j）應拒絕，且不刪除 root 內任何檔案',
      async (prefix) => {
        // Arrange
        await storage.write(
          'avatars/upload-1/md.webp',
          Buffer.from('m'),
          'image/webp',
        );

        // Act
        const act = storage.deleteDir(prefix);

        // Assert
        await expect(act).rejects.toThrow('超出根目錄');
        await expect(
          readFile(join(root, 'avatars/upload-1/md.webp'), 'utf8'),
        ).resolves.toBe('m');
      },
    );
  });

  describe('getPublicUrl', () => {
    it('應以 publicBaseUrl 與 key 組出公開網址', () => {
      // Act
      const url = storage.getPublicUrl('avatars/upload-1/md.webp');

      // Assert
      expect(url).toBe('http://localhost:4001/media/avatars/upload-1/md.webp');
    });

    it('publicBaseUrl 結尾有斜線時不應產生雙斜線', () => {
      // Arrange
      const media = new LocalStorageService(
        root,
        'http://localhost:4001/media/',
      );

      // Act
      const url = media.getPublicUrl('avatars/upload-1/md.webp');

      // Assert
      expect(url).toBe('http://localhost:4001/media/avatars/upload-1/md.webp');
    });

    it('私有儲存（publicBaseUrl 為 null）應丟錯', () => {
      // Arrange
      const temp = new LocalStorageService(root, null);

      // Act
      const act = () => temp.getPublicUrl('avatars/upload-1/original');

      // Assert
      expect(act).toThrow('此 storage 不提供公開網址');
    });

    it('超出 root 的 key 應丟錯', () => {
      // Act
      const act = () => storage.getPublicUrl('../outside.webp');

      // Assert
      expect(act).toThrow('超出根目錄');
    });
  });
});
