import sharp from 'sharp';
import { HttpStatus } from '@nestjs/common';
import { ApiCode } from '@kanban/contracts/api';
import { InvalidAvatarImageException } from '@/common/exceptions/avatar.exception';
import { ImageProcessingService } from './imageProcessing.service';

// 測試圖片全部用 Sharp 即時產生，不在 repo 放二進位 fixture。
type Color = { r: number; g: number; b: number };
const RED: Color = { r: 255, g: 0, b: 0 };
const GREEN: Color = { r: 0, g: 255, b: 0 };
const BLUE: Color = { r: 0, g: 0, b: 255 };

/** 產生單色圖片的 Sharp pipeline。 */
const solid = (width: number, height: number, color: Color = RED) =>
  sharp({ create: { width, height, channels: 3, background: color } });

/** 水平排列多個色塊，產生 (色塊數 × size) × size 的 PNG。 */
const horizontalBlocks = async (colors: Color[], size: number) => {
  const blocks = await Promise.all(
    colors.map((color) => solid(size, size, color).png().toBuffer()),
  );
  return sharp({
    create: {
      width: size * colors.length,
      height: size,
      channels: 3,
      background: RED,
    },
  })
    .composite(
      blocks.map((input, index) => ({ input, left: index * size, top: 0 })),
    )
    .png()
    .toBuffer();
};

/** 讀取輸出圖片在 (x, y) 的 RGB。 */
const pixelAt = async (image: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(image)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const offset = (y * info.width + x) * info.channels;
  return { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
};

/** WebP 是有損壓縮，顏色只比較主要色版是否明顯勝出。 */
const dominantChannel = ({ r, g, b }: Color): 'r' | 'g' | 'b' => {
  if (r > g && r > b) return 'r';
  if (g > r && g > b) return 'g';
  return 'b';
};

describe('ImageProcessingService', () => {
  let service: ImageProcessingService;

  beforeEach(() => {
    service = new ImageProcessingService();
  });

  describe('InvalidAvatarImageException', () => {
    it('不合格圖片由全域 Filter 直接轉成 400 / AvatarInvalidImage', async () => {
      // Arrange
      const input = Buffer.from('not an image');

      // Act
      const error = await service
        .validate(input)
        .catch((caught: unknown) => caught);

      // Assert
      expect(error).toBeInstanceOf(InvalidAvatarImageException);
      const exception = error as InvalidAvatarImageException;
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(exception.code).toBe(ApiCode.AvatarInvalidImage);
    });

    it('截斷的圖片在 render 解碼時同樣回 400 / AvatarInvalidImage', async () => {
      // Arrange
      const png = await solid(64, 64).png().toBuffer();
      const truncated = png.subarray(0, Math.floor(png.length / 2));

      // Act
      const error = await service
        .render(truncated, 'md')
        .catch((caught: unknown) => caught);

      // Assert
      expect(error).toBeInstanceOf(InvalidAvatarImageException);
      expect((error as InvalidAvatarImageException).getStatus()).toBe(
        HttpStatus.BAD_REQUEST,
      );
    });
  });

  describe('validate', () => {
    it.each([
      ['jpeg', () => solid(200, 100).jpeg().toBuffer()],
      ['png', () => solid(200, 100).png().toBuffer()],
      ['webp', () => solid(200, 100).webp().toBuffer()],
    ] as const)('應接受 %s 並回傳真實格式與寬高', async (format, build) => {
      // Arrange
      const input = await build();

      // Act
      const result = await service.validate(input);

      // Assert
      expect(result).toEqual({ format, width: 200, height: 100 });
    });

    it('不支援的格式（GIF）應拒絕', async () => {
      // Arrange
      const input = await solid(8, 8).gif().toBuffer();

      // Act
      const act = service.validate(input);

      // Assert
      await expect(act).rejects.toThrow(InvalidAvatarImageException);
    });

    it('動態 WebP（多頁）應拒絕', async () => {
      // Arrange
      const frames = await Promise.all(
        [RED, GREEN, BLUE].map((color) =>
          solid(32, 32, color).png().toBuffer(),
        ),
      );
      const input = await sharp(frames, { join: { animated: true } })
        .webp({ loop: 0 })
        .toBuffer();

      // Act
      const act = service.validate(input);

      // Assert
      await expect(act).rejects.toThrow(InvalidAvatarImageException);
    });

    it.each([
      ['寬度', 8001, 10],
      ['高度', 10, 8001],
    ])('%s超過 8000 應拒絕', async (_label, width, height) => {
      // Arrange
      const input = await solid(width, height).png().toBuffer();

      // Act
      const act = service.validate(input);

      // Assert
      await expect(act).rejects.toThrow(InvalidAvatarImageException);
    });

    it('寬高都在 8000 以內但總像素超過上限應拒絕', async () => {
      // Arrange：5000 × 5000 = 25,000,000 > 16,000,000
      const input = await solid(5000, 5000).png().toBuffer();

      // Act
      const act = service.validate(input);

      // Assert
      await expect(act).rejects.toThrow(InvalidAvatarImageException);
    });

    it('不是圖片的內容應拒絕', async () => {
      // Act
      const act = service.validate(Buffer.from('not an image'));

      // Assert
      await expect(act).rejects.toThrow(InvalidAvatarImageException);
    });
  });

  describe('render', () => {
    it.each([
      ['sm', 64],
      ['md', 128],
      ['lg', 256],
    ] as const)('%s 應輸出 %i×%i 的 WebP', async (size, px) => {
      // Arrange
      const input = await solid(400, 200).png().toBuffer();

      // Act
      const output = await service.render(input, size);

      // Assert
      const metadata = await sharp(output).metadata();
      expect(metadata).toMatchObject({ format: 'webp', width: px, height: px });
    });

    it('應保留透明度', async () => {
      // Arrange
      const input = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 0.5 },
        },
      })
        .png()
        .toBuffer();

      // Act
      const output = await service.render(input, 'md');

      // Assert
      await expect(sharp(output).metadata()).resolves.toMatchObject({
        hasAlpha: true,
      });
    });

    it('輸出不應保留 EXIF（避免洩漏 GPS 等資訊）', async () => {
      // Arrange
      const input = await solid(100, 100)
        .jpeg()
        .withMetadata({ orientation: 1 })
        .toBuffer();
      const inputMetadata = await sharp(input).metadata();

      // Act
      const output = await service.render(input, 'md');

      // Assert
      expect(inputMetadata.exif).toBeDefined();
      const outputMetadata = await sharp(output).metadata();
      expect(outputMetadata.exif).toBeUndefined();
      expect(outputMetadata.orientation).toBeUndefined();
    });

    it('應依 EXIF 方向轉正後再裁切', async () => {
      // Arrange：原始像素左紅右藍，EXIF 方向 6 代表顯示時順時針轉 90 度，
      // 轉正後應變成上紅下藍；沒轉正則下方仍是紅色。
      const raw = await horizontalBlocks([RED, BLUE], 20);
      const input = await sharp(raw)
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toBuffer();

      // Act
      const output = await service.render(input, 'md');

      // Assert
      expect(dominantChannel(await pixelAt(output, 10, 10))).toBe('r');
      expect(dominantChannel(await pixelAt(output, 10, 118))).toBe('b');
    });

    it('非正方形圖片應置中裁切', async () => {
      // Arrange：紅｜綠｜藍 三個色塊，置中裁成正方形後只應剩下中間的綠色。
      const input = await horizontalBlocks([RED, GREEN, BLUE], 100);

      // Act
      const output = await service.render(input, 'md');

      // Assert
      expect(dominantChannel(await pixelAt(output, 4, 64))).toBe('g');
      expect(dominantChannel(await pixelAt(output, 123, 64))).toBe('g');
    });

    it('截斷的 JPEG（validate 只讀檔頭可能通過）在轉檔時應拒絕', async () => {
      // Arrange
      const full = await sharp({
        create: {
          width: 500,
          height: 500,
          channels: 3,
          // 型別要求 background；有 noise 時實際畫面由雜訊決定（雜訊讓 JPEG 夠大，截斷後才會缺資料）。
          background: RED,
          noise: { type: 'gaussian', mean: 128, sigma: 30 },
        },
      })
        .jpeg()
        .toBuffer();
      const truncated = full.subarray(0, 3000);

      // Act
      const act = service.render(truncated, 'md');

      // Assert
      await expect(act).rejects.toThrow(InvalidAvatarImageException);
    });

    it('總像素超過上限應拒絕（Worker 可能未先呼叫 validate）', async () => {
      // Arrange：5000 × 5000 = 25,000,000 > 16,000,000
      const input = await solid(5000, 5000).png().toBuffer();

      // Act
      const act = service.render(input, 'md');

      // Assert
      await expect(act).rejects.toThrow(InvalidAvatarImageException);
    });

    it('不是圖片的內容應拒絕', async () => {
      // Act
      const act = service.render(Buffer.from('not an image'), 'md');

      // Assert
      await expect(act).rejects.toThrow(InvalidAvatarImageException);
    });
  });
});
