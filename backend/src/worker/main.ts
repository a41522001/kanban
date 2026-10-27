import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { Logger } from 'nestjs-pino';

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  console.log('已啟動worker線程');
};
void bootstrap();
