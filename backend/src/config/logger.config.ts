import type { ConfigService } from '@nestjs/config';
import type { Env } from './env';
import type { Params } from 'nestjs-pino';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';

export const loggerFactory = (
  configService: ConfigService<Env>,
  service: 'api' | 'worker',
): Params => {
  const isProduction =
    configService.getOrThrow('NODE_ENV', { infer: true }) === 'production';
  return {
    pinoHttp: {
      level: isProduction ? 'info' : 'debug',
      base: { pid: process.pid, hostname: hostname(), service },
      genReqId: (req, res) => {
        const requestId = randomUUID();
        res.setHeader('X-Request-Id', requestId);
        return requestId;
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) {
          return 'error';
        }
        if (res.statusCode >= 400) {
          return 'warn';
        }
        return 'info';
      },
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
