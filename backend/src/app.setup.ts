import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './config/env';

export const configureApp = (app: INestApplication): void => {
  const configService = app.get(ConfigService<Env>);
  const frontendUrl = configService.getOrThrow('FRONTEND_URL', { infer: true });
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });
};
