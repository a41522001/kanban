import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Server as HttpServer } from 'node:http';
import { AppModule } from './app.module';
import type { Env } from './config/env';
import { SocketService } from './socket/socket.service';
import { Logger } from 'nestjs-pino';
import { ValidationPipe } from '@nestjs/common';
import { WrapResponseInterceptor } from './common/interceptors/wrapResponse.interceptor';
import { HttpExceptionFilter } from './common/filters/httpException.filter';
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
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自動過濾掉不在 DTO 裡的欄位
      transform: true, // 自動根據 DTO 型別進行轉型
      forbidNonWhitelisted: true, // 傳入多餘欄位時直接報錯
      stopAtFirstError: true,
      // 自定義錯誤格式
      // exceptionFactory: (errors: ValidationError[]) => {
      //   const formattedErrors = formatValidationErrors(errors);
      //   return new BadRequestException({
      //     message: '驗證失敗',
      //     errors: formattedErrors,
      //   });
      // },
    }),
  );
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
