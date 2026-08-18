import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { envSchema } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SessionModule } from './session/session.module';
import { SocketModule } from './socket/socket.module';
import { AuthModule } from './auth/auth.module';
import { LoggerModule } from 'nestjs-pino';
import type { Env } from './config/env';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env>) => {
        const isProduction =
          configService.getOrThrow('NODE_ENV', { infer: true }) ===
          'production';
        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',

            // 本機開發時轉成好閱讀的文字；production 保持 JSON。
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                },

            // auth 專案一開始就要避免敏感資料出現在 log。
            redact: {
              paths: [
                'req.headers.cookie',
                'req.headers.authorization',
                'req.body.password',
                "res.headers['set-cookie']",
              ],
              censor: '[REDACTED]',
            },
          },
        };
      },
    }),
    PrismaModule,
    RedisModule,
    SessionModule,
    SocketModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
