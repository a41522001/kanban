import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SocketService } from './modules/socket/socket.service';
import { Logger } from 'nestjs-pino';
import { configureApp } from './app.setup';
import { setupSwagger } from './swagger.setup';
import { RequestMethod } from '@nestjs/common';
import { resolve } from 'node:path';
import type { AppConfig } from '@/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Response } from 'express';

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.setGlobalPrefix('v1/api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  configureApp(app);
  const configService = app.get(ConfigService<AppConfig, true>);
  const socketService = app.get(SocketService);
  const environment = configService.get('app.nodeEnv', { infer: true });
  const port = configService.get('app.port', { infer: true });
  const httpServer = app.getHttpServer();
  socketService.initialize(httpServer);
  app.useLogger(app.get(Logger));
  if (environment === 'development') {
    const mediaRoot = resolve(
      configService.get('avatar.storageRoot', {
        infer: true,
      }),
    );
    app.useStaticAssets(mediaRoot, {
      prefix: '/media',
      index: false,
      maxAge: '1y',
      immutable: true,
      setHeaders: (res: Response) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    });
  }
  app.enableShutdownHooks();
  setupSwagger(app);
  await app.listen(port);
};
void bootstrap();
