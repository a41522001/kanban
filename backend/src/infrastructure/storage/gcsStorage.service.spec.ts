import { ApiError, type Bucket } from '@google-cloud/storage';
import { GcsStorageService } from './gcsStorage.service';

/** 只實作 GcsStorageService 會用到的 File 方法。 */
type FakeFile = {
  name: string;
  save: jest.Mock;
  download: jest.Mock;
  delete: jest.Mock;
};

const createFakeFile = (name: string): FakeFile => ({
  name,
  save: jest.fn().mockResolvedValue(undefined),
  download: jest.fn(),
  delete: jest.fn().mockResolvedValue([{}]),
});

/** GCS 的 404：與套件實際丟出的錯誤同一個類別，code 為 HTTP 狀態碼。 */
const createApiError = (code: number): ApiError =>
  Object.assign(new ApiError(`GCS error ${code}`), { code });

describe('GcsStorageService', () => {
  const mediaCacheControl = 'public, max-age=31536000, immutable';
  const publicBaseUrl =
    'https://storage.googleapis.com/flowboard-dev-avatar-media';

  let file: FakeFile;
  let bucket: { file: jest.Mock; getFiles: jest.Mock };
  let media: GcsStorageService;
  let temp: GcsStorageService;

  beforeEach(() => {
    file = createFakeFile('avatars/upload-1/md.webp');
    bucket = {
      file: jest.fn().mockReturnValue(file),
      getFiles: jest.fn().mockResolvedValue([[]]),
    };
    media = new GcsStorageService(bucket as unknown as Bucket, {
      publicBaseUrl,
      cacheControl: mediaCacheControl,
    });
    temp = new GcsStorageService(bucket as unknown as Bucket, {
      publicBaseUrl: null,
      cacheControl: null,
    });
  });

  describe('write', () => {
    it('media 應以單一請求上傳，並帶上 contentType 與 Cache-Control', async () => {
      // Arrange
      const body = Buffer.from('webp-bytes');

      // Act
      await media.write('avatars/upload-1/md.webp', body, 'image/webp');

      // Assert
      expect(bucket.file).toHaveBeenCalledWith('avatars/upload-1/md.webp');
      expect(file.save).toHaveBeenCalledWith(body, {
        contentType: 'image/webp',
        resumable: false,
        metadata: { cacheControl: mediaCacheControl },
      });
    });

    it('temp（cacheControl 為 null）不應帶 metadata，避免私有原圖被標為 public', async () => {
      // Arrange
      const body = Buffer.from('original-bytes');

      // Act
      await temp.write('avatars/upload-1/original', body, 'image/png');

      // Assert
      expect(file.save).toHaveBeenCalledWith(body, {
        contentType: 'image/png',
        resumable: false,
        metadata: undefined,
      });
    });

    it('不應加上 ifGenerationMatch，同一個 key 重寫時才能覆蓋（Worker 重試）', async () => {
      // Act
      await media.write(
        'avatars/upload-1/sm.webp',
        Buffer.from('x'),
        'image/webp',
      );

      // Assert
      const [, options] = file.save.mock.calls[0] as [Buffer, object];
      expect(options).not.toHaveProperty('preconditionOpts');
      expect(options).not.toHaveProperty('ifGenerationMatch');
    });

    it('上傳失敗時應把錯誤原樣往外丟', async () => {
      // Arrange
      const error = createApiError(503);
      file.save.mockRejectedValue(error);

      // Act
      const act = media.write(
        'avatars/upload-1/md.webp',
        Buffer.from('x'),
        'image/webp',
      );

      // Assert
      await expect(act).rejects.toBe(error);
    });

    it.each([
      ['空字串', ''],
      ['以 / 開頭', '/avatars/upload-1/md.webp'],
      ['以 / 結尾', 'avatars/upload-1/'],
      ['含 .. 段', 'avatars/../secret'],
    ])('key %s 時應丟錯且不呼叫 GCS', async (_label, key) => {
      // Act
      const act = media.write(key, Buffer.from('x'), 'image/webp');

      // Assert
      await expect(act).rejects.toThrow();
      expect(bucket.file).not.toHaveBeenCalled();
    });

    it('檔名中含 .. 但不是獨立一段時應允許', async () => {
      // Act
      await media.write(
        'avatars/upload-1/a..b.webp',
        Buffer.from('x'),
        'image/webp',
      );

      // Assert
      expect(bucket.file).toHaveBeenCalledWith('avatars/upload-1/a..b.webp');
    });
  });

  describe('read', () => {
    it('應回傳 download() 取得的 Buffer（解開 [Buffer] tuple）', async () => {
      // Arrange
      const content = Buffer.from('original-bytes');
      file.download.mockResolvedValue([content]);

      // Act
      const result = await temp.read('avatars/upload-1/original');

      // Assert
      expect(bucket.file).toHaveBeenCalledWith('avatars/upload-1/original');
      expect(result).toBe(content);
    });

    it('物件不存在（ApiError 404）時應回傳 null', async () => {
      // Arrange
      file.download.mockRejectedValue(createApiError(404));

      // Act
      const result = await temp.read('avatars/upload-1/original');

      // Assert
      expect(result).toBeNull();
    });

    it.each([
      ['403 權限不足', createApiError(403)],
      ['503 暫時錯誤', createApiError(503)],
      ['非 ApiError 的網路錯誤', new Error('ECONNRESET')],
    ])(
      '%s 時應往外丟，交給呼叫端決定是否重試',
      async (_label, error: Error) => {
        // Arrange
        file.download.mockRejectedValue(error);

        // Act
        const act = temp.read('avatars/upload-1/original');

        // Assert
        await expect(act).rejects.toBe(error);
      },
    );

    it('key 格式錯誤時應丟錯且不呼叫 GCS', async () => {
      // Act
      const act = temp.read('../original');

      // Assert
      await expect(act).rejects.toThrow();
      expect(bucket.file).not.toHaveBeenCalled();
    });
  });

  describe('deleteDir', () => {
    it('應列出前綴底下的物件並逐一以 ignoreNotFound 刪除', async () => {
      // Arrange
      const files = [
        createFakeFile('avatars/upload-1/md.webp'),
        createFakeFile('avatars/upload-1/sm.webp'),
        createFakeFile('avatars/upload-1/lg.webp'),
      ];
      bucket.getFiles.mockResolvedValue([files]);

      // Act
      await media.deleteDir('avatars/upload-1/');

      // Assert
      expect(bucket.getFiles).toHaveBeenCalledWith({
        prefix: 'avatars/upload-1/',
      });
      for (const fakeFile of files) {
        expect(fakeFile.delete).toHaveBeenCalledWith({ ignoreNotFound: true });
      }
    });

    it('前綴底下沒有物件時應正常結束（冪等）', async () => {
      // Arrange
      bucket.getFiles.mockResolvedValue([[]]);

      // Act
      const act = media.deleteDir('avatars/upload-1/');

      // Assert
      await expect(act).resolves.toBeUndefined();
    });

    it('任一物件刪除失敗時應把錯誤往外丟', async () => {
      // Arrange
      const error = createApiError(403);
      const failing = createFakeFile('avatars/upload-1/md.webp');
      failing.delete.mockRejectedValue(error);
      bucket.getFiles.mockResolvedValue([[failing]]);

      // Act
      const act = media.deleteDir('avatars/upload-1/');

      // Assert
      await expect(act).rejects.toBe(error);
    });

    it.each([
      ['空字串（等於整個 bucket）', ''],
      ['只有 /', '/'],
      ['沒有以 / 結尾（會刪到同開頭的其他資料夾）', 'avatars/upload-1'],
    ])('prefix %s 時應丟錯且不列出任何物件', async (_label, prefix) => {
      // Act
      const act = media.deleteDir(prefix);

      // Assert
      await expect(act).rejects.toThrow();
      expect(bucket.getFiles).not.toHaveBeenCalled();
    });
  });

  describe('listDirs', () => {
    it('尚未實作，應丟出 NotImplementedException', () => {
      // Act & Assert
      expect(() => media.listDirs('avatars/')).toThrow();
    });
  });

  describe('getPublicUrl', () => {
    it('應以 publicBaseUrl 與 key 組出公開網址', () => {
      // Act
      const url = media.getPublicUrl('avatars/upload-1/md.webp');

      // Assert
      expect(url).toBe(`${publicBaseUrl}/avatars/upload-1/md.webp`);
    });

    it('publicBaseUrl 結尾有斜線時不應產生雙斜線', () => {
      // Arrange
      const storage = new GcsStorageService(bucket as unknown as Bucket, {
        publicBaseUrl: 'https://media.example.com//',
        cacheControl: mediaCacheControl,
      });

      // Act
      const url = storage.getPublicUrl('avatars/upload-1/md.webp');

      // Assert
      expect(url).toBe('https://media.example.com/avatars/upload-1/md.webp');
    });

    it('私有儲存（publicBaseUrl 為 null）應丟錯', () => {
      // Act & Assert
      expect(() => temp.getPublicUrl('avatars/upload-1/original')).toThrow();
    });

    it('key 格式錯誤時應丟錯', () => {
      // Act & Assert
      expect(() => media.getPublicUrl('avatars/../secret')).toThrow();
    });
  });
});
