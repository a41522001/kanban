import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { EmailService } from '../src/infrastructure/email/email.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { RateLimitService } from '../src/infrastructure/redis/rateLimit.service';
import { redisKeys } from '../src/infrastructure/redis/redis.keys';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { verifyTestUser } from './helpers/verify-test-user';
import { ApiCode, type ApiResponse } from '@kanban/contracts/api';
import type { AuthRateLimitedData } from '@kanban/contracts/auth';

/**
 * Login and signup rate limit through the real app, Lua scripts and Redis
 * (docs/features/rate-limit.md §2–§6).
 *
 * .env.e2e keeps every limit at 10000 so other suites never trip it; this suite
 * lowers them before compiling its own app. Each test uses its own email and
 * client IP (sent as X-Forwarded-For, trusted with TRUST_PROXY_HOPS=1), so the
 * counters of one test never affect another.
 */
describe('Login / signup rate limit (e2e)', () => {
  jest.setTimeout(30000);

  const limits = {
    RATE_LIMIT_LOGIN_EMAIL_IP_MAX: '3',
    RATE_LIMIT_LOGIN_EMAIL_IP_WINDOW_SECONDS: '60',
    RATE_LIMIT_LOGIN_IP_MAX: '6',
    RATE_LIMIT_LOGIN_IP_WINDOW_SECONDS: '60',
    RATE_LIMIT_LOGIN_EMAIL_MAX: '8',
    RATE_LIMIT_LOGIN_EMAIL_WINDOW_SECONDS: '120',
    RATE_LIMIT_SIGNUP_IP_MAX: '2',
    RATE_LIMIT_SIGNUP_IP_WINDOW_SECONDS: '60',
  };
  const password = 'testtest';
  const usedEmails: string[] = [];
  const usedIps: string[] = [];
  const originalEnv = { ...process.env };

  // Private-range addresses that no other suite sends.
  const newIp = (): string => {
    const ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
    usedIps.push(ip);
    return ip;
  };
  const newEmail = (): string => {
    const email = `rate-limit-${randomUUID()}@example.com`;
    usedEmails.push(email);
    return email;
  };

  const createApp = async (
    env: Record<string, string>,
  ): Promise<NestExpressApplication> => {
    if (process.env.E2E_ENV !== 'true')
      throw new Error('只能使用隔離的 E2E 環境');
    // Namespace factories read process.env when the module compiles.
    Object.assign(process.env, env);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue({ sendVerifyEmail: jest.fn() })
      .compile();
    const app = module.createNestApplication<NestExpressApplication>();
    configureApp(app);
    // Listen once up front. Given a server that is not listening, supertest calls listen(0)
    // per request and closes the server when that request ends, which resets the other
    // requests still in flight (ECONNRESET on Linux CI in the concurrent-burst test).
    await app.listen(0);
    return app;
  };

  const cleanUpKeys = async (app: NestExpressApplication): Promise<void> => {
    const keys = [
      ...usedIps.flatMap((ip) => [
        redisKeys.rateLimitLoginIp(ip),
        redisKeys.rateLimitSignupIp(ip),
        ...usedEmails.map((email) =>
          redisKeys.rateLimitLoginEmailIp(email, ip),
        ),
      ]),
      ...usedEmails.map((email) => redisKeys.rateLimitLoginEmail(email)),
    ];
    if (keys.length > 0) await app.get(RedisService).getClient().del(keys);
  };

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('TRUST_PROXY_HOPS=1（經過一層 Nginx）', () => {
    let app: NestExpressApplication;
    let server: App;

    const login = (email: string, ip: string, pass = 'wrong-password') =>
      request(server)
        .post('/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email, password: pass });

    const signup = (email: string, ip: string) =>
      request(server)
        .post('/auth/signup')
        .set('X-Forwarded-For', ip)
        .send({ email, password, name: 'Rate limit test' });

    /** Registers and verifies an account from a throwaway IP, so the test's own IP starts at zero. */
    const createVerifiedUser = async (): Promise<string> => {
      const email = newEmail();
      await signup(email, newIp()).expect(201);
      await verifyTestUser(app, email);
      return email;
    };

    const getCount = (key: string) =>
      app.get(RedisService).getClient().get(key);

    const expectRateLimited = (
      res: request.Response,
      code: ApiCode,
      windowSeconds: number,
    ) => {
      const body = res.body as ApiResponse<AuthRateLimitedData>;
      expect(res.status).toBe(429);
      expect(body).toMatchObject({
        code,
        message: '嘗試次數過多，請稍後再試',
      });
      expect(body.data?.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(body.data?.retryAfterSeconds).toBeLessThanOrEqual(windowSeconds);
    };

    beforeAll(async () => {
      app = await createApp({ ...limits, TRUST_PROXY_HOPS: '1' });
      server = app.getHttpServer();
    });

    afterAll(async () => {
      await cleanUpKeys(app);
      await app?.close();
    });

    describe('login', () => {
      it('同一 email + IP 失敗 3 次後回 429，連正確密碼也不比對', async () => {
        // Arrange
        const email = await createVerifiedUser();
        const ip = newIp();
        for (let i = 0; i < 3; i++) await login(email, ip).expect(401);

        // Act
        const res = await login(email, ip, password);

        // Assert
        expectRateLimited(res, ApiCode.LoginRateLimited, 60);
        expect(res.headers['set-cookie']).toBeUndefined();
        // Blocked requests are not counted.
        await expect(
          getCount(redisKeys.rateLimitLoginEmailIp(email, ip)),
        ).resolves.toBe('3');
      });

      it('密碼正確時清空 email + IP，IP 與 email 只退回這一次', async () => {
        // Arrange
        const email = await createVerifiedUser();
        const ip = newIp();
        for (let i = 0; i < 2; i++) await login(email, ip).expect(401);

        // Act
        await login(email, ip, password).expect(200);

        // Assert
        await expect(
          getCount(redisKeys.rateLimitLoginEmailIp(email, ip)),
        ).resolves.toBeNull();
        await expect(getCount(redisKeys.rateLimitLoginIp(ip))).resolves.toBe(
          '2',
        );
        await expect(
          getCount(redisKeys.rateLimitLoginEmail(email)),
        ).resolves.toBe('2');
        // email + IP restarts from zero: three more failures are allowed again.
        for (let i = 0; i < 3; i++) await login(email, ip).expect(401);
        expectRateLimited(await login(email, ip), ApiCode.LoginRateLimited, 60);
      });

      it('密碼正確但信箱未驗證（403）也會退回', async () => {
        // Arrange
        const email = newEmail();
        await signup(email, newIp()).expect(201);
        const ip = newIp();
        await login(email, ip).expect(401);

        // Act
        await login(email, ip, password).expect(403);

        // Assert
        await expect(
          getCount(redisKeys.rateLimitLoginEmailIp(email, ip)),
        ).resolves.toBeNull();
        await expect(getCount(redisKeys.rateLimitLoginIp(ip))).resolves.toBe(
          '1',
        );
      });

      it('同一 IP 對不同 email 累計 6 次後，換新 email 也被擋', async () => {
        // Arrange: emails that do not exist count exactly like wrong passwords.
        const ip = newIp();
        for (let i = 0; i < 6; i++) await login(newEmail(), ip).expect(401);

        // Act
        const res = await login(newEmail(), ip);

        // Assert
        expectRateLimited(res, ApiCode.LoginRateLimited, 60);
      });

      it('同一 email 從不同 IP 累計 8 次後，換新 IP 也被擋', async () => {
        // Arrange
        const email = await createVerifiedUser();
        for (let i = 0; i < 8; i++) await login(email, newIp()).expect(401);

        // Act
        const res = await login(email, newIp());

        // Assert
        expectRateLimited(res, ApiCode.LoginRateLimited, 120);
      });

      it('同時送出 20 個請求，只有 3 個進到比對密碼', async () => {
        // Arrange
        const email = newEmail();
        const ip = newIp();

        // Act
        const responses = await Promise.all(
          Array.from({ length: 20 }, () => login(email, ip)),
        );

        // Assert
        const statuses = responses.map((res) => res.status);
        expect(statuses.filter((status) => status === 401)).toHaveLength(3);
        expect(statuses.filter((status) => status === 429)).toHaveLength(17);
        await expect(
          getCount(redisKeys.rateLimitLoginEmailIp(email, ip)),
        ).resolves.toBe('3');
      });
    });

    describe('signup', () => {
      it('同一 IP 第 3 次註冊回 429，重複 email 也算一次，被擋的不建立帳號', async () => {
        // Arrange
        const ip = newIp();
        const email = newEmail();
        await signup(email, ip).expect(201);
        await signup(email, ip).expect(409);
        const blockedEmail = newEmail();

        // Act
        const res = await signup(blockedEmail, ip);

        // Assert
        expectRateLimited(res, ApiCode.SignupRateLimited, 60);
        await expect(
          app
            .get(PrismaService)
            .user.findUnique({ where: { email: blockedEmail } }),
        ).resolves.toBeNull();
      });
    });

    describe('trust proxy', () => {
      it('只信任 Nginx 加上的最右邊位址，最左邊偽造的 IP 不會被當成 client', async () => {
        // Arrange
        const spoofedIp = newIp();
        const realIp = newIp();

        // Act
        await request(server)
          .post('/auth/login')
          .set('X-Forwarded-For', `${spoofedIp}, ${realIp}`)
          .send({ email: newEmail(), password: 'wrong-password' })
          .expect(401);

        // Assert
        await expect(
          getCount(redisKeys.rateLimitLoginIp(realIp)),
        ).resolves.toBe('1');
        await expect(
          getCount(redisKeys.rateLimitLoginIp(spoofedIp)),
        ).resolves.toBeNull();
      });
    });

    describe('refund script', () => {
      it('比對密碼期間 IP 與 email 的 key 剛好過期，退回時不會產生 -1 的 key', async () => {
        // Arrange
        const rateLimit = app.get(RateLimitService);
        const client = app.get(RedisService).getClient();
        const email = newEmail();
        const ip = newIp();
        await rateLimit.hitLogin(email, ip);
        // Simulate the window ending between hit and refund.
        await client.del([
          redisKeys.rateLimitLoginIp(ip),
          redisKeys.rateLimitLoginEmail(email),
        ]);

        // Act
        await rateLimit.refundLogin(email, ip);

        // Assert
        await expect(
          client.exists([
            redisKeys.rateLimitLoginEmailIp(email, ip),
            redisKeys.rateLimitLoginIp(ip),
            redisKeys.rateLimitLoginEmail(email),
          ]),
        ).resolves.toBe(0);
      });

      it('退回後 key 保留原本的 TTL，視窗不會重新開始', async () => {
        // Arrange
        const rateLimit = app.get(RateLimitService);
        const client = app.get(RedisService).getClient();
        const email = newEmail();
        const ip = newIp();
        await rateLimit.hitLogin(email, ip);
        await rateLimit.hitLogin(email, ip);
        const ipKey = redisKeys.rateLimitLoginIp(ip);
        await client.pExpire(ipKey, 30_000);

        // Act
        await rateLimit.refundLogin(email, ip);

        // Assert
        await expect(client.get(ipKey)).resolves.toBe('1');
        const ttl = await client.pTTL(ipKey);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(30_000);
      });
    });
  });

  describe('TRUST_PROXY_HOPS=0（開發環境直連）', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      // Every suite logs in from 127.0.0.1, so keep the IP limit out of the way here.
      app = await createApp({
        ...limits,
        RATE_LIMIT_LOGIN_IP_MAX: '10000',
        TRUST_PROXY_HOPS: '0',
      });
    });

    afterAll(async () => {
      await cleanUpKeys(app);
      await app?.close();
    });

    it('忽略 X-Forwarded-For，以連線位址計數', async () => {
      // Arrange
      const forwardedIp = newIp();
      const email = newEmail();

      // Act
      await request(app.getHttpServer() as App)
        .post('/auth/login')
        .set('X-Forwarded-For', forwardedIp)
        .send({ email, password: 'wrong-password' })
        .expect(401);

      // Assert
      const client = app.get(RedisService).getClient();
      await expect(
        client.get(redisKeys.rateLimitLoginIp(forwardedIp)),
      ).resolves.toBeNull();
      const [emailIpKey] = await client.keys(
        `${redisKeys.rateLimitLoginEmailIp(email, '')}*`,
      );
      // supertest connects over loopback: 127.0.0.1 or its IPv4-mapped IPv6 form.
      expect(emailIpKey).toMatch(/:(::ffff:)?127\.0\.0\.1$/);
      await client.del(emailIpKey);
    });
  });
});
