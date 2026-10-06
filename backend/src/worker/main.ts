import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  console.log('已啟動worker線程');
};
void bootstrap();
