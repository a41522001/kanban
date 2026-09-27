import { Test, TestingModule } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { WorkerModule } from '../src/worker/worker.module';
import { EmailService } from '../src/email/email.service';
import { QueueService } from '../src/queue/queue.service';
import { RedisService } from '../src/redis/redis.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/user/user.service';
import { redisKeys } from '../src/redis/redis.keys';
import { ApiCode, type ApiResponse } from '@kanban/contracts/api';
import type { SignupRequest, SignupResult } from '@kanban/contracts/auth';

describe('Auth + Queue + Worker (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication<App>;
  let worker: TestingModule;
  let redis: RedisService;
  let prisma: PrismaService;
  let cooldownSeconds: number;
  const emails = new Map<string, string[]>();
  // 真的跑 BullMQ Worker，在 SMTP 邊界攔下信件，測試不寄出真實 Email。
  const emailService = {
    sendVerifyEmail: jest.fn((email: string, url: string) => {
      emails.set(email, [...(emails.get(email) ?? []), url]);
      return Promise.resolve();
    }),
  };
  const newAccount = (): SignupRequest => ({
    email: 'auth-' + randomUUID() + '@example.com',
    password: 'testtest',
    name: 'Auth test',
  });
  const waitForToken = async (email: string, index = 0): Promise<string> => {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const url = emails.get(email)?.[index];
      if (url) return new URL(url).pathname.split('/').at(-1)!;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Worker 未在期限內處理驗證信');
  };

  beforeAll(async () => {
    if (process.env.E2E_ENV !== 'true')
      throw new Error('只能使用隔離的 E2E 環境');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue(emailService)
      .compile();
    app = module.createNestApplication();
    await app.init();
    redis = app.get(RedisService);
    prisma = app.get(PrismaService);
    cooldownSeconds = app
      .get(ConfigService)
      .getOrThrow<number>('RATE_LIMIT_VERIFY_EMAIL_SECONDS');
    worker = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider(EmailService)
      .useValue(emailService)
      .compile();
    await worker.init();
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await worker?.close();
    await app?.close();
  });

  it('註冊、冷卻、Worker 寄信、重寄、驗證、登入與登出', async () => {
    const user = newAccount();
    const credentials = { email: user.email, password: user.password };
    const agent = request.agent(app.getHttpServer());
    const signup = await agent.post('/auth/signup').send(user).expect(201);
    expect(signup.body as ApiResponse<SignupResult>).toMatchObject({
      code: ApiCode.Success,
      data: {
        accountCreated: true,
        emailQueued: true,
        retryAfterSeconds: cooldownSeconds,
      },
      error: null,
    });
    const denied = await agent
      .post('/auth/login')
      .send(credentials)
      .expect(403);
    expect(denied.body as ApiResponse<unknown>).toMatchObject({
      code: ApiCode.EmailVerificationRequired,
      data: { email: user.email },
    });
    expect(denied.headers['set-cookie']).toBeUndefined();
    await agent.get('/user/userInfo').expect(401);
    await agent
      .post('/auth/login')
      .send({ ...credentials, password: 'wrongpassword' })
      .expect(401);

    const cooldown = await agent
      .post('/auth/resend-verification-email')
      .send({ email: user.email })
      .expect(429);
    const cooldownBody = cooldown.body as ApiResponse<{
      retryAfterSeconds: number;
    }>;
    expect(cooldownBody.code).toBe(ApiCode.EmailVerificationCooldown);
    expect(cooldownBody.data!.retryAfterSeconds).toBeGreaterThan(0);
    expect(cooldown.headers['retry-after']).toBeUndefined();
    const token = await waitForToken(user.email);
    expect(
      await redis.getClient().ttl(redisKeys.verifyEmail(token)),
    ).toBeGreaterThan(0);

    // 測試中直接讓 Redis 冷卻過期，避免每次等 60 秒。
    await redis.getClient().del(redisKeys.rateLimitEmailVerify(user.email));
    const resend = await agent
      .post('/auth/resend-verification-email')
      .send({ email: user.email })
      .expect(202);
    expect(resend.body as ApiResponse<unknown>).toMatchObject({
      data: { retryAfterSeconds: cooldownSeconds },
    });
    const secondToken = await waitForToken(user.email, 1);
    await agent.patch('/auth/verify/' + token).expect(200);
    const verified = await prisma.user.findUniqueOrThrow({
      where: { email: user.email },
    });
    expect(verified.emailVerifiedAt).not.toBeNull();
    expect(await redis.getClient().exists(redisKeys.verifyEmail(token))).toBe(
      0,
    );
    await agent.patch('/auth/verify/' + secondToken).expect(200);
    const after = await prisma.user.findUniqueOrThrow({
      where: { email: user.email },
    });
    expect(after.emailVerifiedAt).toEqual(verified.emailVerifiedAt);
    await agent.patch('/auth/verify/' + token).expect(400);

    const login = await agent.post('/auth/login').send(credentials).expect(200);
    expect(login.headers['set-cookie']).toBeDefined();
    await agent.get('/user/userInfo').expect(200);
    await agent.post('/auth/logout').expect(200);
    await agent.get('/user/userInfo').expect(401);
  });

  it('註冊入列失敗保留帳號，前端可透過重寄恢復', async () => {
    const user = newAccount();
    jest
      .spyOn(app.get(QueueService), 'addVerificationEmailQueue')
      .mockRejectedValueOnce(new Error('Queue unavailable'));
    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send(user)
      .expect(201);
    expect(response.body as ApiResponse<SignupResult>).toMatchObject({
      code: ApiCode.SignupEmailQueueFailed,
      data: { accountCreated: true, emailQueued: false },
    });
    expect(
      await prisma.user.findUnique({ where: { email: user.email } }),
    ).not.toBeNull();
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send(user)
      .expect(409);
    await redis.getClient().del(redisKeys.rateLimitEmailVerify(user.email));
    await request(app.getHttpServer())
      .post('/auth/resend-verification-email')
      .send({ email: user.email })
      .expect(202);
    const token = await waitForToken(user.email);
    await request(app.getHttpServer())
      .patch('/auth/verify/' + token)
      .expect(200);
  });

  it('無效或過期 token 回 400，DB / Redis 故障回 500，故障後可重試', async () => {
    const user = newAccount();
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send(user)
      .expect(201);
    const token = await waitForToken(user.email);
    const invalid = await request(app.getHttpServer())
      .patch('/auth/verify/missing-token')
      .expect(400);
    expect(invalid.body as ApiResponse<unknown>).toMatchObject({
      code: ApiCode.AuthVerifyFail,
    });

    const update = jest
      .spyOn(app.get(UserService), 'updateUserToVerifiedAccount')
      .mockRejectedValueOnce(new Error('DB unavailable'));
    const failed = await request(app.getHttpServer())
      .patch('/auth/verify/' + token)
      .expect(500);
    expect(failed.body as ApiResponse<unknown>).toMatchObject({
      code: ApiCode.InternalError,
      data: null,
    });
    expect(await redis.getClient().exists(redisKeys.verifyEmail(token))).toBe(
      1,
    );
    update.mockRestore();
    jest
      .spyOn(redis.getClient(), 'hGetAll')
      .mockRejectedValueOnce(new Error('Redis unavailable'));
    await request(app.getHttpServer())
      .patch('/auth/verify/' + token)
      .expect(500);
    await request(app.getHttpServer())
      .patch('/auth/verify/' + token)
      .expect(200);

    const expired = randomUUID();
    await redis.getClient().hSet(redisKeys.verifyEmail(expired), {
      userId: 'unused',
      email: user.email,
    });
    await redis.getClient().expire(redisKeys.verifyEmail(expired), 0);
    await request(app.getHttpServer())
      .patch('/auth/verify/' + expired)
      .expect(400);
  });

  it('重寄驗證輸入、正規化信箱，不存在帳號也有一致冷卻', async () => {
    await request(app.getHttpServer())
      .post('/auth/resend-verification-email')
      .send({ email: 'invalid' })
      .expect(400);
    const email = 'missing-' + randomUUID() + '@example.com';
    const spy = jest.spyOn(app.get(QueueService), 'addVerificationEmailQueue');
    const accepted = await request(app.getHttpServer())
      .post('/auth/resend-verification-email')
      .send({ email: ' ' + email.toUpperCase() + ' ' })
      .expect(202);
    expect(accepted.body as ApiResponse<unknown>).toMatchObject({
      data: { retryAfterSeconds: cooldownSeconds },
    });
    await request(app.getHttpServer())
      .post('/auth/resend-verification-email')
      .send({ email })
      .expect(429);
    expect(spy).not.toHaveBeenCalled();
  });

  it('並行驗證只保留第一次的驗證時間', async () => {
    const user = newAccount();
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send(user)
      .expect(201);
    const token = await waitForToken(user.email);
    const row = await prisma.user.findUniqueOrThrow({
      where: { email: user.email },
    });
    const secondToken = randomUUID();
    await redis.getClient().hSet(redisKeys.verifyEmail(secondToken), {
      userId: row.id,
      email: user.email,
    });
    await redis.getClient().expire(redisKeys.verifyEmail(secondToken), 60);
    await Promise.all(
      [token, secondToken].map((value) =>
        request(app.getHttpServer())
          .patch('/auth/verify/' + value)
          .expect(200),
      ),
    );
    const firstTime = (
      await prisma.user.findUniqueOrThrow({ where: { id: row.id } })
    ).emailVerifiedAt;
    await app.get(UserService).updateUserToVerifiedAccount(row.id);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: row.id } }))
        .emailVerifiedAt,
    ).toEqual(firstTime);
  });
});
