/** Avatar 上傳檔案大小上限（bytes），即 5 MiB。 */
export const AVATAR_MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Avatar 上傳允許的 MIME 類型；前端選檔與後端 declared MIME 檢查共用。 */
export const AVATAR_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AvatarMimeType = (typeof AVATAR_ALLOWED_MIME_TYPES)[number];

/** 使用者目前頭像的各尺寸 URL。 */
export interface AvatarImageSet {
  /** 64px，背景產生；尚未完成時為 null。 */
  smallUrl: string | null;
  /** 128px，上傳時同步產生，一定存在。 */
  mediumUrl: string;
  /** 256px，背景產生；尚未完成時為 null。 */
  largeUrl: string | null;
}
