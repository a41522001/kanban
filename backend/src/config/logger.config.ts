import type { ConfigService } from '@nestjs/config';
import type { Env } from './env';
import type { Params } from 'nestjs-pino';
export const loggerFactory = (configService: ConfigService<Env>): Params => {
  const isProduction =
    configService.getOrThrow('NODE_ENV', { infer: true }) === 'production';
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
};
