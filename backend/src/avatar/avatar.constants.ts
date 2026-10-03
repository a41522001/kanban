/** Sharp 解碼前允許的總像素上限，避免超大圖片耗盡記憶體。 */
export const AVATAR_MAX_PIXELS = 16_000_000;

/** 原圖寬、高各自的上限（px）。 */
export const AVATAR_MAX_DIMENSION = 8000;

/** 輸出 WebP 的品質（1..100）。 */
export const AVATAR_WEBP_QUALITY = 80;

/** 各尺寸的檔名 key 與輸出邊長（px）；檔名不含像素數字，調整尺寸時 key 不變。 */
export const AVATAR_SIZES = {
  sm: 64,
  md: 128,
  lg: 256,
} as const;

export type AvatarSizeKey = keyof typeof AVATAR_SIZES;

/** 每位使用者在時間窗內可上傳的次數。 */
export const AVATAR_UPLOAD_LIMIT = 5;

/** 上傳頻率限制的時間窗（秒）。 */
export const AVATAR_UPLOAD_WINDOW_SECONDS = 60;

/** 未被引用的 media 目錄，超過此時數才會被孤兒清理刪除。 */
export const AVATAR_ORPHAN_GRACE_HOURS = 24;

/** 未被引用的 temp 原圖，超過此時數才會被孤兒清理刪除。 */
export const AVATAR_TEMP_ORPHAN_GRACE_HOURS = 1;

/** Avatar Worker 同時處理的 job 數。 */
export const AVATAR_WORKER_CONCURRENCY = 2;
