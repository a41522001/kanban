import { Env } from '@/config/env';
import bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
/**
 * 對密碼進行加鹽hash處理。
 * @param {string} password - 需要hash處理的純文字密碼。
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
