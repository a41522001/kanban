import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { SignupDto } from './signup.dto';

const validateSignup = async (
  input: Record<string, unknown>,
): Promise<{ dto: SignupDto; errors: ValidationError[] }> => {
  const dto = plainToInstance(SignupDto, input);
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

describe('SignupDto', () => {
  it('應正規化 Email 與名稱，但不修改密碼', async () => {
    const password = ' password123 ';
    const { dto, errors } = await validateSignup({
      email: '  USER@Example.COM ',
      password,
      name: '  Jeffery  ',
    });

    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('user@example.com');
    expect(dto.password).toBe(password);
    expect(dto.name).toBe('Jeffery');
  });

  it('應拒絕缺少 Email、密碼與名稱', async () => {
    const { errors } = await validateSignup({});

    expect(getFieldError(errors, 'email')).toBeDefined();
    expect(getFieldError(errors, 'password')).toBeDefined();
    expect(getFieldError(errors, 'name')).toBeDefined();
  });

  it('應拒絕非字串型別', async () => {
    const { errors } = await validateSignup({
      email: 123,
      password: 123,
      name: 123,
    });

    expect(getFieldError(errors, 'email')).toBeDefined();
    expect(getFieldError(errors, 'password')).toBeDefined();
    expect(getFieldError(errors, 'name')).toBeDefined();
  });

  it('應拒絕錯誤的 Email、過短密碼與空白名稱', async () => {
    const { errors } = await validateSignup({
      email: 'not-an-email',
      password: 'short',
      name: '   ',
    });

    expect(getFieldError(errors, 'email')?.constraints).toEqual({
      isEmail: 'Email 格式不正確',
    });
    expect(getFieldError(errors, 'password')?.constraints).toEqual({
      minLength: '密碼至少需要 8 個字元',
    });
    expect(getFieldError(errors, 'name')?.constraints).toBeDefined();
  });

  it('應拒絕超過長度限制的欄位', async () => {
    const { errors } = await validateSignup({
      email: 'a'.repeat(309) + '@example.com',
      password: 'a'.repeat(73),
      name: 'a'.repeat(101),
    });

    expect(getFieldError(errors, 'email')?.constraints).toEqual({
      maxLength: 'Email 長度不可超過 320 個字元',
    });
    expect(getFieldError(errors, 'password')?.constraints).toEqual({
      maxLength: '密碼不可超過 72 個字元',
    });
    expect(getFieldError(errors, 'name')?.constraints).toEqual({
      maxLength: '名稱不可超過 100 個字元',
    });
  });

  it('應拒絕 DTO 未定義的欄位', async () => {
    const { errors } = await validateSignup({
      email: 'user@example.com',
      password: 'password123',
      name: 'Jeffery',
      role: 'admin',
    });

    expect(getFieldError(errors, 'role')?.constraints).toEqual({
      whitelistValidation: 'property role should not exist',
    });
  });
});
