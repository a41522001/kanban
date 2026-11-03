import type { Response } from 'express';
import type { AppConfig } from '@/config';
import { ConfigService } from '@nestjs/config';

const getCookieOptions = (configService: ConfigService<AppConfig, true>) => {
  const isProduction =
    configService.get('app.nodeEnv', { infer: true }) === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  } as const;
};

const clearCookie = (
  configService: ConfigService<AppConfig, true>,
  res: Response,
  key: string,
): void => {
  const options = getCookieOptions(configService);
  res.clearCookie(key, options);
};
export { getCookieOptions, clearCookie };
