import { Injectable } from '@nestjs/common';
import {
  AVATAR_MAX_DIMENSION,
  AVATAR_MAX_PIXELS,
  AVATAR_SIZES,
  AVATAR_WEBP_QUALITY,
  type AvatarSizeKey,
} from '../avatar.constants';
import sharp from 'sharp';

/** validate 通過後回傳的原圖資訊。 */
export interface AvatarImageMetadata {
  /** Sharp 解析出的真實格式，與檔名或 declared MIME 無關。 */
  format: 'jpeg' | 'png' | 'webp';
  width: number;
  height: number;
}

/** 允許上傳的真實圖片格式。 */
const ALLOWED_FORMATS = ['jpeg', 'png', 'webp'] as const;

/**
 * 型別守衛：判斷 Sharp 解析出的格式是否在允許清單內。
 * 回傳 true 時，TypeScript 會把 format 收窄為 `AvatarImageMetadata['format']`。
 */
const isAllowedFormat = (
  format: string | undefined,
): format is AvatarImageMetadata['format'] =>
  (ALLOWED_FORMATS as readonly string[]).includes(format ?? '');

/**
 * 圖片內容不合格：解碼失敗、格式不符、動圖、尺寸或像素超限。
 * 由 controller 轉成 400 / AvatarInvalidImage；訊息只供 log 與測試，不直接回給前端。
 */
export class InvalidAvatarImageError extends Error {}

/**
 * Avatar 圖片驗證與轉檔。
 * 只負責 Sharp 圖片處理，不注入 Prisma 或 Storage，方便以 fixture 單元測試。
 */
@Injectable()
export class ImageProcessingService {
  /**
   * 讀取圖片檔頭並檢查格式、動圖、寬高與總像素。
   * 只讀檔頭，截斷或損壞的檔案可能通過，需搭配 render 的完整解碼才算驗證完成。
   *
   * @param input 上傳的原始檔案內容。
   * @returns 真實格式與寬高。
   * @throws {InvalidAvatarImageError} 無法解析、格式不支援、動圖、寬高或總像素超限。
   */
  async validate(input: Buffer): Promise<AvatarImageMetadata> {
    let metadata: sharp.Metadata;
    try {
      // 總像素超過 limitInputPixels 時，Sharp 在讀 metadata 階段就會丟錯。
      metadata = await sharp(input, {
        limitInputPixels: AVATAR_MAX_PIXELS,
      }).metadata();
    } catch {
      throw new InvalidAvatarImageError('無法解析圖片');
    }

    const { format, width, height, pages } = metadata;

    if (!isAllowedFormat(format)) {
      throw new InvalidAvatarImageError('不支援的圖片格式');
    }
    // 靜態圖的 pages 為 undefined；大於 1 代表動態 WebP 等多頁格式。
    if (pages && pages > 1) {
      throw new InvalidAvatarImageError('不支援動圖');
    }
    if (!width || width > AVATAR_MAX_DIMENSION) {
      throw new InvalidAvatarImageError('寬度超越上限');
    }
    if (!height || height > AVATAR_MAX_DIMENSION) {
      throw new InvalidAvatarImageError('高度超越上限');
    }

    return { format, width, height };
  }

  /**
   * 依 EXIF 轉正後，置中裁成指定尺寸的正方形 WebP。
   * 輸出不保留 EXIF／GPS 等 metadata。
   *
   * @param input 原始檔案內容；Worker 可能未先呼叫 validate，因此這裡也限制總像素。
   * @param size 尺寸 key（sm／md／lg），對應像素見 AVATAR_SIZES。
   * @returns WebP 檔案內容。
   * @throws {InvalidAvatarImageError} 解碼或轉檔失敗（例如檔案被截斷、總像素超限）。
   */
  async render(input: Buffer, size: AvatarSizeKey): Promise<Buffer> {
    const px = AVATAR_SIZES[size];

    try {
      // Sharp 的各步驟只是設定，到 toBuffer() 才真正解碼與轉檔，錯誤都在此時出現。
      return await sharp(input, { limitInputPixels: AVATAR_MAX_PIXELS })
        .autoOrient()
        .resize(px, px, { fit: 'cover', position: 'centre' })
        .webp({ quality: AVATAR_WEBP_QUALITY })
        .toBuffer();
    } catch {
      throw new InvalidAvatarImageError('圖片解碼或轉檔失敗');
    }
  }
}
