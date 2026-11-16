/** 新位置與前一個項目的預設間距；重新編號也使用相同間距（1024、2048、3072……）。 */
export const POSITION_STEP = 1024;

/**
 * 算出放在 after 與 next 之間的新 position（卡片與欄位共用，Board 規格 §4.3、§8.3）。
 * - after：前一個項目的 position；放在最前面時為 0。
 * - next：下一個項目的 position；沒有下一個時為 null。
 * 三種情況：
 *   1. 沒有下一個 → after + POSITION_STEP
 *   2. 中間有整數可用 → 取中間值（整數）
 *   3. 相鄰、沒有整數可用 → null，呼叫端需要重新編號後再算一次
 */
export const positionBetween = (
  after: number,
  next: number | null,
): number | null => {
  if (next === null) {
    return after + POSITION_STEP;
  }
  if (next - after > 1) {
    return after + Math.floor((next - after) / 2);
  }
  return null;
};
