import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import type { ConfigService } from '@nestjs/config';
import pino from 'pino';
import type { Params } from 'nestjs-pino';
import type { Env } from './env';
import { loggerFactory } from './logger.config';

// pino-http 不是 backend 的直接依賴，改由 nestjs-pino 的 Params 推導型別：
// loggerFactory 回傳 pinoHttp: [設定, 輸出目的地]。
type PinoHttpTuple = Extract<NonNullable<Params['pinoHttp']>, unknown[]>;
type PinoHttpOptions = PinoHttpTuple[0];

type MultiStreamLike = {
  streams: { level: number; stream: { flush?: () => Promise<void> } }[];
};

const createConfig = (nodeEnv: Env['NODE_ENV'], seqUrl?: string) =>
  ({
    getOrThrow: () => nodeEnv,
    get: (key: string) => (key === 'SEQ_URL' ? seqUrl : undefined),
  }) as unknown as ConfigService<Env>;

/** 取出 loggerFactory 產生的 [設定, 輸出目的地]。 */
const getPinoHttp = async (
  nodeEnv: Env['NODE_ENV'] = 'production',
  service: 'api' | 'worker' = 'api',
  seqUrl?: string,
): Promise<PinoHttpTuple> => {
  const params = await loggerFactory(createConfig(nodeEnv, seqUrl), service);
  return params.pinoHttp as PinoHttpTuple;
};

/** 取出 loggerFactory 產生的 pino-http 設定。 */
const getOptions = async (
  nodeEnv: Env['NODE_ENV'] = 'production',
  service: 'api' | 'worker' = 'api',
): Promise<PinoHttpOptions> => (await getPinoHttp(nodeEnv, service))[0];

/** 每 20ms 檢查一次，直到條件成立或逾時。 */
const waitFor = async (condition: () => boolean, timeoutMs = 2000) => {
  const start = Date.now();
  while (!condition() && Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

/** 以 loggerFactory 的設定建立真正的 pino，並收集輸出的 JSON。 */
const createCapturingLogger = async () => {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      callback();
    },
  });
  const { redact, base, level } = await getOptions();
  return { logger: pino({ redact, base, level }, stream), lines };
};

describe('loggerFactory', () => {
  describe('redaction', () => {
    it('Cookie、Authorization、密碼與 Set-Cookie 應被遮住', async () => {
      // Arrange
      const { logger, lines } = await createCapturingLogger();

      // Act
      logger.info(
        {
          req: {
            headers: {
              cookie: 'sessionId=raw-session-id',
              authorization: 'Bearer secret-token',
              'user-agent': 'jest',
            },
            body: { email: 'a@example.com', password: 'plain-password' },
          },
          res: { headers: { 'set-cookie': 'sessionId=new-session-id' } },
        },
        'request completed',
      );

      // Assert
      const output = JSON.stringify(lines[0]);
      expect(output).not.toContain('raw-session-id');
      expect(output).not.toContain('secret-token');
      expect(output).not.toContain('plain-password');
      expect(output).not.toContain('new-session-id');
      expect(lines[0]).toMatchObject({
        req: {
          headers: {
            cookie: '[REDACTED]',
            authorization: '[REDACTED]',
            'user-agent': 'jest',
          },
          body: { password: '[REDACTED]' },
        },
        res: { headers: { 'set-cookie': '[REDACTED]' } },
      });
    });
  });

  describe('service 欄位', () => {
    it.each(['api', 'worker'] as const)(
      '每筆 log 帶 service: %s，並保留 pid、hostname',
      async (service) => {
        // Act
        const { base } = await getOptions('production', service);

        // Assert
        expect(base).toMatchObject({
          service,
          pid: process.pid,
          hostname: expect.any(String) as string,
        });
      },
    );
  });

  describe('requestId', () => {
    it('每個請求產生新的 UUID，並寫入 X-Request-Id 回應 header', async () => {
      // Arrange
      const { genReqId } = await getOptions();
      const setHeader = jest.fn();
      const res = { setHeader } as unknown as ServerResponse;
      const req = {
        headers: { 'x-request-id': 'forged-id' },
      } as unknown as IncomingMessage;

      // Act
      const first = genReqId!(req, res);
      const second = genReqId!(req, res);

      // Assert
      expect(first).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(second).not.toBe(first);
      // 不採用請求自帶的 X-Request-Id
      expect(first).not.toBe('forged-id');
      expect(setHeader).toHaveBeenCalledWith('X-Request-Id', first);
    });
  });

  describe('request log level', () => {
    it.each([
      [200, undefined, 'info'],
      [302, undefined, 'info'],
      [400, undefined, 'warn'],
      [404, undefined, 'warn'],
      [500, undefined, 'error'],
      [503, undefined, 'error'],
      [200, new Error('boom'), 'error'],
    ])('狀態碼 %i（error: %s）記為 %s', async (statusCode, error, expected) => {
      // Arrange
      const { customLogLevel } = await getOptions();
      const req = {} as IncomingMessage;
      const res = { statusCode } as ServerResponse;

      // Act
      const level = customLogLevel!(req, res, error);

      // Assert
      expect(level).toBe(expected);
    });
  });

  describe('環境差異', () => {
    it('開發環境 level 為 debug，終端機輸出經由 pino-pretty（不再使用 transport）', async () => {
      // Act
      const [options, stream] = await getPinoHttp('development');

      // Assert
      expect(options.level).toBe('debug');
      expect(options).not.toHaveProperty('transport');
      expect(stream).toBeDefined();
    });

    it('正式環境 level 為 info，輸出 JSON 到 stdout', async () => {
      // Act
      const [options, stream] = await getPinoHttp('production');

      // Assert
      expect(options.level).toBe('info');
      expect(options).not.toHaveProperty('transport');
      expect(stream).toBeDefined();
    });

    it('debug log 會送到終端機（multistream 的目的地 level 與設定一致）', async () => {
      // Arrange：開發環境的目的地應接受 debug 等級
      const [options, stream] = await getPinoHttp('development');
      const multistream = stream as unknown as MultiStreamLike;

      // Act
      const debugLevel = pino.levels.values[options.level as string];

      // Assert
      expect(multistream.streams[0].level).toBe(debugLevel);
    });
  });
  describe('Seq', () => {
    it('沒有設定 SEQ_URL 時只輸出到終端機', async () => {
      // Act
      const [, stream] = await getPinoHttp('development');

      // Assert
      expect((stream as unknown as MultiStreamLike).streams).toHaveLength(1);
    });

    it('設定 SEQ_URL 時多一個 Seq 目的地，level 與終端機一致', async () => {
      // Act
      const [, stream] = await getPinoHttp(
        'development',
        'api',
        'http://localhost:5341',
      );

      // Assert
      const { streams } = stream as unknown as MultiStreamLike;
      expect(streams).toHaveLength(2);
      expect(streams[1].level).toBe(streams[0].level);
    });

    it('設定 SEQ_URL 時 log 會以 Seq 格式送到該網址（含 event 欄位，敏感資料已遮住）', async () => {
      // Arrange：以本機 HTTP server 代替 Seq，收集送來的請求
      const received: { url: string; body: string }[] = [];
      const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk: Buffer) => (body += chunk.toString()));
        req.on('end', () => {
          received.push({ url: req.url ?? '', body });
          res.writeHead(201);
          res.end();
        });
      });
      await new Promise<void>((resolve) => server.listen(0, resolve));

      // server 啟動之後的步驟都放在 try 裡：任何一步失敗都會關閉 server，Jest 才不會卡住。
      try {
        const { port } = server.address() as AddressInfo;
        const [options, stream] = await getPinoHttp(
          'production',
          'api',
          `http://localhost:${port}`,
        );
        const { redact, base, level } = options;
        const logger = pino({ redact, base, level }, stream);
        // multistream 會調整目的地順序，不能用索引取，改依類型找出 Seq 的目的地。
        const seqEntry = (stream as unknown as MultiStreamLike).streams.find(
          (entry) => entry.stream.constructor.name === 'PinoSeqStream',
        );
        expect(seqEntry).toBeDefined();

        // Act
        logger.error(
          {
            event: 'avatar.upload.write_failed',
            req: { headers: { cookie: 'sessionId=raw-session-id' } },
          },
          '請求處理失敗',
        );
        await seqEntry!.stream.flush!();
        // flush 完成時，本機 server 不一定已處理完請求，等到收到為止（最多 2 秒）。
        await waitFor(() => received.length > 0);

        // Assert
        expect(received).toHaveLength(1);
        expect(received[0].url).toBe('/api/events/raw');
        expect(received[0].body).toContain('avatar.upload.write_failed');
        expect(received[0].body).toContain('請求處理失敗');
        expect(received[0].body).not.toContain('raw-session-id');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });
});
