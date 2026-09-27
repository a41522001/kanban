import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { createClient, RedisClientType } from 'redis';
import { SESSION_SCRIPTS, type SessionScripts } from '@/session/session.script';
import { createNodeRedisClient, type IRedisClient } from 'bullmq';
type EmptyRedisExtensions = Record<string, never>;

type AppRedisClient = RedisClientType<
  EmptyRedisExtensions,
  EmptyRedisExtensions,
  SessionScripts
>;
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: AppRedisClient;
  private readonly mqRedisClient: IRedisClient;
  constructor(configService: ConfigService<Env>) {
    this.client = createClient({
      url: configService.getOrThrow('REDIS_URL', {
        infer: true,
      }),
      scripts: SESSION_SCRIPTS,
    });

    this.client.on('error', (error) => {
      console.error('Redis error:', error);
    });

    this.mqRedisClient = createNodeRedisClient(
      createClient({
        url: configService.getOrThrow('REDIS_URL', {
          infer: true,
        }),
      }),
    );

    this.mqRedisClient.on('error', (error) => {
      console.error('Redis error:', error);
    });
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

  async destroyBullMqConnection(): Promise<void> {
    await this.mqRedisClient.quit();
  }
}
