import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { createClient, RedisClientType } from 'redis';
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: RedisClientType;

  constructor(configService: ConfigService<Env>) {
    this.client = createClient({
      url: configService.getOrThrow('REDIS_URL', {
        infer: true,
      }),
    });
    this.client.on('error', (error) => {
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

  getClient(): RedisClientType {
    return this.client;
  }
}
