import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { LoginDto } from './login.dto';

const validateLogin = async (
  input: Record<string, unknown>,
): Promise<{ dto: LoginDto; errors: ValidationError[] }> => {
  const dto = plainToInstance(LoginDto, input);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  });

  return { dto, errors };
};

const getFieldError = (
  errors: ValidationError[],
  property: string,
): ValidationError | undefined =>
  errors.find((error) => error.property === property);

describe('LoginDto', () => {
  it('應正規化 Email，但不修改密碼', async () => {
    const password = ' password123 ';
    const { dto, errors } = await validateLogin({
      email: '  USER@Example.COM ',
      password,
    });

    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('user@example.com');
    expect(dto.password).toBe(password);
  });

  it('應拒絕缺少 Email 與密碼', async () => {
    const { errors } = await validateLogin({});

    expect(getFieldError(errors, 'email')?.constraints).toEqual({
      isNotEmpty: 'Email 不可為空',
    });
    expect(getFieldError(errors, 'password')?.constraints).toEqual({
      isNotEmpty: '密碼不可為空',
    });
  });

  it('應拒絕非字串型別', async () => {
    const { errors } = await validateLogin({
      email: 123,
      password: 123,
    });

    expect(getFieldError(errors, 'email')?.constraints).toEqual({
      isString: 'Email 必須是字串',
    });
    expect(getFieldError(errors, 'password')?.constraints).toEqual({
      isString: '密碼必須是字串',
    });
  });

  it('應拒絕錯誤的 Email 格式與過短密碼', async () => {
    const { errors } = await validateLogin({
      email: 'not-an-email',
      password: 'short',
    });

    expect(getFieldError(errors, 'email')?.constraints).toEqual({
      isEmail: 'Email 格式不正確',
    });
    expect(getFieldError(errors, 'password')?.constraints).toEqual({
      minLength: '密碼至少需要 8 個字元',
    });
  });

  it('應拒絕超過長度限制的欄位', async () => {
    const { errors } = await validateLogin({
      email: 'a'.repeat(309) + '@example.com',
      password: 'a'.repeat(73),
    });

    expect(getFieldError(errors, 'email')?.constraints).toEqual({
      maxLength: 'Email 長度不可超過 320 個字元',
    });
    expect(getFieldError(errors, 'password')?.constraints).toEqual({
      maxLength: '密碼不可超過 72 個字元',
    });
  });

  it('應拒絕 DTO 未定義的欄位', async () => {
    const { errors } = await validateLogin({
      email: 'user@example.com',
      password: 'password123',
      role: 'admin',
    });

    expect(getFieldError(errors, 'role')?.constraints).toEqual({
      whitelistValidation: 'property role should not exist',
    });
  });
});
