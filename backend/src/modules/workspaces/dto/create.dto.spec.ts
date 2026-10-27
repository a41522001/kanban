import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { CreateDto } from './create.dto';

const validateCreateWorkspace = async (
  input: Record<string, unknown>,
): Promise<{ dto: CreateDto; errors: ValidationError[] }> => {
  const dto = plainToInstance(CreateDto, input);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  });

  return { dto, errors };
};

describe('CreateDto', () => {
  it('應移除工作區名稱前後空白', async () => {
    const { dto, errors } = await validateCreateWorkspace({
      name: '  My Workspace  ',
    });

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('My Workspace');
  });

  it('應拒絕空白工作區名稱', async () => {
    const { errors } = await validateCreateWorkspace({ name: '   ' });

    expect(errors[0]?.constraints).toEqual({
      isNotEmpty: '工作區名稱不可為空',
    });
  });

  it('應拒絕非字串工作區名稱', async () => {
    const { errors } = await validateCreateWorkspace({ name: 123 });

    expect(errors[0]?.constraints).toEqual({
      isString: '工作區名稱必須是字串',
    });
  });

  it('應拒絕超過 100 個字元的工作區名稱', async () => {
    const { errors } = await validateCreateWorkspace({
      name: 'x'.repeat(101),
    });

    expect(errors[0]?.constraints).toEqual({
      maxLength: '工作區名稱不可超過 100 個字元',
    });
  });

  it('應拒絕 DTO 未定義的欄位', async () => {
    const { errors } = await validateCreateWorkspace({
      name: 'My Workspace',
      createdById: 'hidden-user-id',
    });

    expect(errors[0]?.constraints).toEqual({
      whitelistValidation: 'property createdById should not exist',
    });
  });
});
