import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

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
  it('/auth/signup (POST)', async () => {
    const agent = request.agent(app.getHttpServer());
    const response = await agent.post('/auth/signup').send(user).expect(201);

    expect(response.body).toMatchObject({
      code: 1,
      data: null,
      message: '註冊成功',
      error: null,
    });
  });

  it('/auth/login (POST)', async () => {
    const { email, password } = user;
    const agent = request.agent(app.getHttpServer());
    const response = await agent
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      code: 1,
      data: null,
      message: '登入成功',
      error: null,
    });
  });
  afterAll(async () => {
    await app.close();
  });
});
