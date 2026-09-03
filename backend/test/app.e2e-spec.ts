import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { ApiCode } from '@kanban/contracts/api';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });
  const user = {
    email: 'test@test.com',
    password: 'testtest',
    name: 'test',
  };

  it('註冊且登入後可取得使用者資訊，登出後 Session 失效', async () => {
    const { email, password } = user;
    const agent = request.agent(app.getHttpServer());
    // 註冊
    const signupResponse = await agent
      .post('/auth/signup')
      .send(user)
      .expect(201);
    // 登入
    expect(signupResponse.body).toMatchObject({
      code: ApiCode.Success,
      data: null,
      message: '註冊成功',
      error: null,
    });
    await agent
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);
    // 取得userInfo
    await agent.get('/user/userInfo').expect(200);
    // 登出
    await agent.post('/auth/logout').expect(200);
    // 取得userInfo
    await agent.get('/user/userInfo').expect(401);
  });

  afterAll(async () => {
    await app.close();
  });
});
