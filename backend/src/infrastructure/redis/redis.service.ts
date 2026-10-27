import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  OnApplicationShutdown,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env';
import { createClient, RedisClientType } from 'redis';
import {
  SESSION_SCRIPTS,
  type SessionScripts,
} from '@/modules/session/session.script';
import { createNodeRedisClient, type IRedisClient } from 'bullmq';
import { LOG_EVENTS } from '@/common/constants/logEvents';
type EmptyRedisExtensions = Record<string, never>;

type AppRedisClient = RedisClientType<
  EmptyRedisExtensions,
  EmptyRedisExtensions,
  SessionScripts
>;
@Injectable()
export class RedisService
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  private readonly client: AppRedisClient;
  private readonly mqRedisClient: IRedisClient;
  private readonly logger = new Logger(RedisService.name);
  constructor(configService: ConfigService<Env>) {
    this.client = createClient({
      url: configService.getOrThrow('REDIS_URL', {
        infer: true,
      }),
      scripts: SESSION_SCRIPTS,
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(
        { event: LOG_EVENTS.redisClientError, err: error },
        'Redis 連線錯誤',
      );
    });

    this.mqRedisClient = createNodeRedisClient(
      createClient({
        url: configService.getOrThrow('REDIS_URL', {
          infer: true,
        }),
      }),
    );

    this.mqRedisClient.on('error', (error: Error) => {
      this.logger.error(
        { event: LOG_EVENTS.redisClientError, err: error },
        'Redis 連線錯誤',
      );
    });
  }

  async onApplicationShutdown() {
    await this.mqRedisClient.quit();
  }

  async onModuleInit(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }

  getClient(): AppRedisClient {
    return this.client;
  }

  createBullMQConnection(): IRedisClient {
    return this.mqRedisClient;
  }
}
