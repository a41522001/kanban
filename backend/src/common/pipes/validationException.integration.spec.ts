import { LoginDto } from '@/auth/dto/login.dto';
import { HttpExceptionFilter } from '@/common/filters/httpException.filter';
import type { ApiResponse } from '@kanban/contracts/api';
import { Body, Controller, type INestApplication, Post } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createValidationPipe } from './validation.pipe';

@Controller('validation-test')
class ValidationTestController {
  @Post()
  validate(@Body() body: LoginDto): LoginDto {
    return body;
  }
}

describe('ValidationPipe + HttpExceptionFilter integration', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ValidationTestController],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('應透過完整 HTTP 流程回傳 field errors，且不洩漏密碼', async () => {
    const response = await request(app.getHttpServer())
      .post('/validation-test')
      .send({
        email: 'invalid-email',
        password: 'short',
        role: 'admin',
      })
      .expect(400);
    const body = response.body as unknown as ApiResponse<null>;

    expect(Number.isNaN(Date.parse(body.time))).toBe(false);
    expect(body).toEqual({
      code: 0,
      message: '請求參數錯誤',
      time: body.time,
      data: null,
      error: {
        email: {
          value: 'invalid-email',
          messages: ['Email 格式不正確'],
        },
        password: {
          value: null,
          messages: ['密碼至少需要 8 個字元'],
        },
        role: {
          value: 'admin',
          messages: ['property role should not exist'],
        },
      },
    });
  });
});
