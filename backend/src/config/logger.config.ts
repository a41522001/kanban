import type { ConfigService } from '@nestjs/config';
import type { Env } from './env';
import type { Params } from 'nestjs-pino';
import pino from 'pino';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';

export const loggerFactory = async (
  configService: ConfigService<Env>,
  service: 'api' | 'worker',
): Promise<Params> => {
  const isProduction =
    configService.getOrThrow('NODE_ENV', { infer: true }) === 'production';
  const seqUrl = configService.get('SEQ_URL', { infer: true });
  const level = isProduction ? 'info' : 'debug';

  // 終端機輸出：開發用 pino-pretty（devDependency，只在開發時載入），正式環境直接輸出 JSON 到 stdout。
  const terminal = isProduction
    ? pino.destination(1)
    : (await import('pino-pretty')).default({
        colorize: true,
        singleLine: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      });
  // 輸出目的地：一律輸出到終端機；有設定 SEQ_URL 時同時送進 Seq。
  const streams: pino.StreamEntry[] = [{ level, stream: terminal }];
  if (seqUrl) {
    // pino-seq 只提供 ESM，CommonJS 專案必須用動態 import() 載入（不能用一般 import）。
    const { createStream } = await import('pino-seq');
    streams.push({ level, stream: createStream({ serverUrl: seqUrl }) });
  }

  return {
    // [設定, 輸出目的地]：設定寫在陣列第一個位置，函式參數才能依位置推導出 pino-http 的型別。
    pinoHttp: [
      {
        level,
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
      pino.multistream(streams),
    ],
  };
};
