import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { Logger } from 'nestjs-pino';
import { LOG_EVENTS } from '@/common/constants/logEvents';
import { Logger as NestLogger } from '@nestjs/common';
const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  new NestLogger('WorkerBootstrap').log(
    { event: LOG_EVENTS.workerProcessStarted },
    'Worker 已啟動',
  );
};
void bootstrap();
