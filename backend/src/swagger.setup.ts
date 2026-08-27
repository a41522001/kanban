import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const setupSwagger = (app: INestApplication): void => {
  const config = new DocumentBuilder()
    .setTitle('Flowboard API')
    .setDescription('Flowboard Kanban backend API 文件')
    .setVersion('1.0.0')
    .addCookieAuth('sessionId')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Flowboard API Docs',
    jsonDocumentUrl: 'api/docs-json',
  });
};
