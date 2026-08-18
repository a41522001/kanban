import type { Response } from 'express';
import { Env } from '@/config/env';
import { ConfigService } from '@nestjs/config';

const getCookieOptions = (configService: ConfigService<Env>) => {
  const isProduction =
    configService.get('NODE_ENV', { infer: true }) === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  } as const;
};

const clearCookie = (
  configService: ConfigService<Env>,
  res: Response,
  key: string,
): void => {
  const options = getCookieOptions(configService);
  res.clearCookie(key, options);
};
export { getCookieOptions, clearCookie };
