import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { AddCategoryDto } from './addCategory.dto';

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';

const validateAddCategory = async (
  input: Record<string, unknown>,
): Promise<{ dto: AddCategoryDto; errors: ValidationError[] }> => {
  const dto = plainToInstance(AddCategoryDto, input);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  });

  return { dto, errors };
};

const errorFields = (errors: ValidationError[]) =>
  errors.map((error) => error.property);

describe('AddCategoryDto', () => {
  it('接受名稱與色票，並移除名稱前後空白', async () => {
    // Arrange
    const input = { projectId: PROJECT_ID, name: '  後端  ', colorKey: 'mint' };

    // Act
    const { dto, errors } = await validateAddCategory(input);

    // Assert
    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('後端');
  });

  it('接受剛好 20 個字元的名稱', async () => {
    const { errors } = await validateAddCategory({
      projectId: PROJECT_ID,
      name: '一'.repeat(20),
      colorKey: 'coral',
    });

    expect(errors).toHaveLength(0);
  });

  it.each([
    ['只有空白', '   '],
    ['超過 20 個字元', '一'.repeat(21)],
    ['不是字串', 123],
    ['沒有送', undefined],
  ])('名稱%s時驗證失敗', async (_case, name) => {
    const { errors } = await validateAddCategory({
      projectId: PROJECT_ID,
      name,
      colorKey: 'mint',
    });

    expect(errorFields(errors)).toEqual(['name']);
  });

  it.each([
    ['不在色票內', 'red'],
    ['大小寫不符', 'Mint'],
    ['沒有送', undefined],
  ])('色票%s時驗證失敗', async (_case, colorKey) => {
    const { errors } = await validateAddCategory({
      projectId: PROJECT_ID,
      name: '後端',
      colorKey,
    });

    expect(errorFields(errors)).toEqual(['colorKey']);
  });

  it('projectId 不是 UUID 時驗證失敗', async () => {
    const { errors } = await validateAddCategory({
      projectId: 'not-a-uuid',
      name: '後端',
      colorKey: 'mint',
    });

    expect(errorFields(errors)).toEqual(['projectId']);
  });

  it('拒絕未定義的欄位', async () => {
    const { errors } = await validateAddCategory({
      projectId: PROJECT_ID,
      name: '後端',
      colorKey: 'mint',
      normalizedName: '後端',
    });

    expect(errorFields(errors)).toEqual(['normalizedName']);
  });
});
