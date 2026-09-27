import type { INestApplication } from '@nestjs/common';
import { UserService } from '../../src/user/user.service';

/** 非 Auth 的 e2e 測試使用已驗證帳號；完整驗證流程由 auth.e2e.spec.ts 測試。 */
export const verifyTestUser = async (
  app: INestApplication,
  email: string,
): Promise<void> => {
  const users = app.get(UserService);
  const user = await users.getByEmail(email);
  if (!user) throw new Error('找不到測試帳號');
  await users.updateUserToVerifiedAccount(user.id);
};
