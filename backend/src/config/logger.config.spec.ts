import type { IncomingMessage, ServerResponse } from 'node:http';
import { Writable } from 'node:stream';
import type { ConfigService } from '@nestjs/config';
import pino from 'pino';
import type { Params } from 'nestjs-pino';
import type { Env } from './env';
import { loggerFactory } from './logger.config';

// pino-http 不是 backend 的直接依賴，改由 nestjs-pino 的 Params 推導選項型別：
// pinoHttp 可能是選項物件、stream 或 [選項, stream]，只取選項物件。
type PinoHttpOptions = Exclude<
  NonNullable<Params['pinoHttp']>,
  unknown[] | { write: unknown }
>;

const createConfig = (nodeEnv: Env['NODE_ENV']) =>
  ({
    getOrThrow: () => nodeEnv,
  }) as unknown as ConfigService<Env>;

/** 取出 loggerFactory 產生的 pino-http 選項。 */
const getOptions = (
  nodeEnv: Env['NODE_ENV'] = 'production',
  service: 'api' | 'worker' = 'api',
): PinoHttpOptions =>
  loggerFactory(createConfig(nodeEnv), service).pinoHttp as PinoHttpOptions;

/** 以 loggerFactory 的設定建立真正的 pino，並收集輸出的 JSON。 */
const createCapturingLogger = () => {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      callback();
    },
  });
  const { redact, base, level } = getOptions();
  return { logger: pino({ redact, base, level }, stream), lines };
};

describe('loggerFactory', () => {
  describe('redaction', () => {
    it('Cookie、Authorization、密碼與 Set-Cookie 應被遮住', () => {
      // Arrange
      const { logger, lines } = createCapturingLogger();

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
      (service) => {
        // Act
        const { base } = getOptions('production', service);

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
    it('每個請求產生新的 UUID，並寫入 X-Request-Id 回應 header', () => {
      // Arrange
      const { genReqId } = getOptions();
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
    ])('狀態碼 %i（error: %s）記為 %s', (statusCode, error, expected) => {
      // Arrange
      const { customLogLevel } = getOptions();
      const req = {} as IncomingMessage;
      const res = { statusCode } as ServerResponse;

      // Act
      const level = customLogLevel!(req, res, error);

      // Assert
      expect(level).toBe(expected);
    });
  });

  describe('環境差異', () => {
    it('開發環境 level 為 debug，並以 pino-pretty 輸出', () => {
      // Act
      const options = getOptions('development');

      // Assert
      expect(options.level).toBe('debug');
      expect(options.transport).toMatchObject({ target: 'pino-pretty' });
    });

    it('正式環境 level 為 info，輸出 JSON（不使用 transport）', () => {
      // Act
      const options = getOptions('production');

      // Assert
      expect(options.level).toBe('info');
      expect(options.transport).toBeUndefined();
    });
  });
});
