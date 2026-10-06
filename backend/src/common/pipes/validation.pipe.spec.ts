import type { ArgumentMetadata } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { LoginDto } from '@/auth/dto/login.dto';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import { createValidationPipe } from './validation.pipe';

const loginBodyMetadata: ArgumentMetadata = {
  type: 'body',
  metatype: LoginDto,
};

const getValidationException = async (
  input: Record<string, unknown>,
): Promise<AppException> => {
  const pipe = createValidationPipe();

  try {
    await pipe.transform(input, loginBodyMetadata);
  } catch (error: unknown) {
    if (error instanceof AppException) {
      return error;
    }

    throw error;
  }

  throw new Error('預期 ValidationPipe 拋出 AppException');
};

describe('createValidationPipe', () => {
  it('應轉換合法的 request body，並套用 DTO 的 Transform', async () => {
    const pipe = createValidationPipe();

    const result = (await pipe.transform(
      {
        email: '  USER@Example.COM ',
        password: ' password123 ',
      },
      loginBodyMetadata,
    )) as LoginDto;

    expect(result).toBeInstanceOf(LoginDto);
    expect(result.email).toBe('user@example.com');
    expect(result.password).toBe(' password123 ');
  });

  it('應將 DTO validation error 轉成 AppException 與 FieldErrors', async () => {
    const exception = await getValidationException({
      email: 'not-an-email',
      password: 'short',
    });

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.code).toBe(ApiCode.ValidationError);
    expect(exception.message).toBe('請求參數錯誤');
    expect(exception.errors).toEqual({
      email: {
        value: 'not-an-email',
        messages: ['Email 格式不正確'],
      },
      password: {
        value: null,
        messages: ['密碼至少需要 8 個字元'],
      },
    });
  });

  it('應拒絕 DTO 未定義的欄位', async () => {
    const exception = await getValidationException({
      email: 'user@example.com',
      password: 'password123',
      role: 'admin',
    });

    expect(exception.errors).toEqual({
      role: {
        value: 'admin',
        messages: ['property role should not exist'],
      },
    });
  });

  it('應遮蔽敏感欄位，且限制回傳的錯誤值長度', async () => {
    const exception = await getValidationException({
      email: 'x'.repeat(250),
      password: 'wrong',
    });

    expect(exception.errors?.email?.value).toBe('x'.repeat(200));
    expect(exception.errors?.password?.value).toBeNull();
  });
});
