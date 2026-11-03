import type { TransformFnParams } from 'class-transformer';

/** 去掉字串前後空白；非字串原樣交給後續的 validator 處理。 */
export const trimString = (params: TransformFnParams): unknown => {
  const rawValue: unknown = params.value;
  return typeof rawValue === 'string' ? rawValue.trim() : rawValue;
};
