import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@/config';

export const configureApp = (app: INestApplication): void => {
  const configService = app.get(ConfigService<AppConfig, true>);
  const frontendUrl = configService.get('app.frontendUrl', { infer: true });
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });
};
