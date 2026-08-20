import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Server as HttpServer } from 'node:http';
import { AppModule } from './app.module';
import type { Env } from './config/env';
import { SocketService } from './socket/socket.service';
import { Logger } from 'nestjs-pino';
import { WrapResponseInterceptor } from './common/interceptors/wrapResponse.interceptor';
import { HttpExceptionFilter } from './common/filters/httpException.filter';
import { createValidationPipe } from './common/pipes/validation.pipe';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService<Env>);
  const socketService = app.get(SocketService);
  const port = configService.getOrThrow('PORT', { infer: true });
  const frontendUrl = configService.getOrThrow('FRONTEND_URL', { infer: true });
  const httpServer = app.getHttpServer() as HttpServer;
  socketService.initialize(httpServer);
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalInterceptors(new WrapResponseInterceptor());
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Flowboard API')
    .setDescription('Flowboard Kanban backend API 文件')
    .setVersion('1.0.0')
    .addCookieAuth('sessionId')
    .build();
  app.useGlobalFilters(new HttpExceptionFilter());
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    customSiteTitle: 'Flowboard API Docs',
    jsonDocumentUrl: 'api/docs-json',
  });

  await app.listen(port);
}
void bootstrap();
