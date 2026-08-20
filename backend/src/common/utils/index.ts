import { Env } from '@/config/env';
import bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import type { FieldErrors } from '@kanban/contracts/api';
import type { ValidationError } from 'class-validator';
/**
 * 對密碼進行加鹽hash處理。
 * @param {string} password - 需要hash處理的純文字密碼。
 * @param {ConfigService<Env>} configService - 用來取得 bcrypt salt rounds 的設定服務。
 * @returns {Promise<string>} hash過的密碼字串。
 */
export const saltPassword = async (
  password: string,
  configService: ConfigService<Env>,
): Promise<string> => {
  const saltRounds: number = configService.getOrThrow('SALT_ROUNDS', {
    infer: true,
  });
  const bcryptPassword = await bcrypt.hash(password, saltRounds);
  return bcryptPassword;
};

/**
 * 比對純文字密碼與hash過的密碼是否相符。
 * @param {string} userPassword - 使用者輸入的純文字密碼。
 * @param {string} hashPassword - 資料庫中儲存的hash密碼。
 * @returns {Promise<boolean>} 如果密碼相符則解析為 true，否則為 false。
 */
export const decodePassword = async (
  userPassword: string,
  hashPassword: string,
): Promise<boolean> => {
  const isPasswordExist = await bcrypt.compare(userPassword, hashPassword);
  return isPasswordExist;
};

/** 不可出現在驗證錯誤 response 中的敏感欄位名稱。 */
const sensitiveFields = new Set([
  'password',
  'confirmPassword',
  'token',
  'authorization',
]);

/**
 * 將驗證失敗的輸入值轉換成可安全回傳的內容。
 * 敏感欄位、空值與複雜物件一律回傳 null；字串最多保留 200 個字元，
 * 避免洩漏憑證或讓惡意輸入放大 response 大小。
 * @param {string} property - 發生驗證錯誤的 DTO 欄位名稱。
 * @param {unknown} rawValue - class-validator 提供的原始輸入值。
 * @returns {unknown} 經過遮蔽與長度限制後的安全值。
 */
const getSafeValidationValue = (
  property: string,
  rawValue: unknown,
): unknown => {
  if (sensitiveFields.has(property)) {
    return null;
  }

  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (typeof rawValue === 'string') {
    // 避免攻擊者輸入超長內容，造成 response amplification。
    return rawValue.slice(0, 200);
  }

  if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
    return rawValue;
  }

  // 不直接回傳 object、array 等複雜輸入。
  return null;
};

/**
 * 將 class-validator 的第一層驗證錯誤轉換成 API 使用的欄位錯誤格式。
 * 沒有 constraints 的錯誤會被略過，每個欄位會包含安全處理後的輸入值與錯誤訊息。
 * 目前僅處理 flat DTO；若未來使用 ValidateNested，需再遞迴處理 ValidationError.children。
 * @param {ValidationError[]} errors - ValidationPipe exceptionFactory 收到的驗證錯誤。
 * @returns {FieldErrors} 以 DTO 欄位名稱為 key 的錯誤集合。
 */
export const formatValidationErrors = (
  errors: ValidationError[],
): FieldErrors => {
  const result: FieldErrors = {};

  for (const error of errors) {
    const messages = Object.values(error.constraints ?? {});

    if (messages.length === 0) {
      continue;
    }

    const rawValue: unknown = error.value;

    result[error.property] = {
      value: getSafeValidationValue(error.property, rawValue),
      messages,
    };
  }

  return result;
};
