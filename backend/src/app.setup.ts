import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@/config';
import type { NestExpressApplication } from '@nestjs/platform-express';

export const configureApp = (app: NestExpressApplication): void => {
  const configService = app.get(ConfigService<AppConfig, true>);
  const frontendUrl = configService.get('app.frontendUrl', { infer: true });
  const hops = configService.get('app.trustProxyHops', {
    infer: true,
  });
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });
  app.set('trust proxy', hops);
};
