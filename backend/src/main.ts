import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SocketService } from './socket/socket.service';
import { Logger } from 'nestjs-pino';
import { configureApp } from './app.setup';
import type { Server as HttpServer } from 'node:http';
import type { Env } from './config/env';
import { setupSwagger } from './swagger.setup';
import { RequestMethod } from '@nestjs/common';
const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.setGlobalPrefix('v1/api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  configureApp(app);
  const configService = app.get(ConfigService<Env>);
  const socketService = app.get(SocketService);
  const port = configService.getOrThrow('PORT', { infer: true });
  const httpServer = app.getHttpServer() as HttpServer;
  socketService.initialize(httpServer);
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  setupSwagger(app);
  await app.listen(port);
};
void bootstrap();
