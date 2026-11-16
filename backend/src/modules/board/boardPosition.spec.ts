import { POSITION_STEP, positionBetween } from './boardPosition';

describe('positionBetween', () => {
  it.each([
    ['沒有下一個（放最後）', 3072, null, 3072 + POSITION_STEP],
    ['空的欄位或專案（放最前面也是最後）', 0, null, POSITION_STEP],
    ['放最前面', 0, 1024, 512],
    ['兩者之間取中間值', 1024, 2048, 1536],
    ['間距為奇數時無條件捨去', 1024, 1027, 1025],
    ['間距為 2 時取唯一可用的整數', 1024, 1026, 1025],
  ])('%s', (_label, after, next, expected) => {
    expect(positionBetween(after, next)).toBe(expected);
  });

  it.each([
    ['相鄰（間距 1）', 1024, 1025],
    ['放最前面但第一個已是 1', 0, 1],
  ])('%s → null，需要重新編號', (_label, after, next) => {
    expect(positionBetween(after, next)).toBeNull();
  });
});
