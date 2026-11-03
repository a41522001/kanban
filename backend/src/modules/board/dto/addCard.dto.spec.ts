import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { AddCardDto } from './addCard.dto';

const COLUMN_ID = '550e8400-e29b-41d4-a716-446655440000';

const validateAddCard = async (
  input: Record<string, unknown>,
): Promise<{ dto: AddCardDto; errors: ValidationError[] }> => {
  const dto = plainToInstance(AddCardDto, input);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  });

  return { dto, errors };
};

const errorFields = (errors: ValidationError[]) =>
  errors.map((error) => error.property);

describe('AddCardDto', () => {
  it('接受標題與描述，並移除前後空白', async () => {
    // Arrange
    const input = {
      columnId: COLUMN_ID,
      title: '  建立看板 API  ',
      description: '  先完成新增卡片  ',
    };

    // Act
    const { dto, errors } = await validateAddCard(input);

    // Assert
    expect(errors).toHaveLength(0);
    expect(dto.title).toBe('建立看板 API');
    expect(dto.description).toBe('先完成新增卡片');
  });

  it('描述可省略', async () => {
    // Arrange
    const input = { columnId: COLUMN_ID, title: '建立看板 API' };

    // Act
    const { dto, errors } = await validateAddCard(input);

    // Assert
    expect(errors).toHaveLength(0);
    expect(dto.description).toBeUndefined();
  });

  it('只有空白的描述 trim 後為空字串，仍通過驗證（由 service 存成 null）', async () => {
    // Arrange
    const input = {
      columnId: COLUMN_ID,
      title: '建立看板 API',
      description: '   ',
    };

    // Act
    const { dto, errors } = await validateAddCard(input);

    // Assert
    expect(errors).toHaveLength(0);
    expect(dto.description).toBe('');
  });

  it.each([
    ['只有空白的標題', { columnId: COLUMN_ID, title: '   ' }, 'title'],
    [
      '超過 200 字的標題',
      { columnId: COLUMN_ID, title: 'a'.repeat(201) },
      'title',
    ],
    [
      '超過 5000 字的描述',
      { columnId: COLUMN_ID, title: '標題', description: 'a'.repeat(5001) },
      'description',
    ],
    [
      '非 UUID v4 的 columnId',
      { columnId: 'column-1', title: '標題' },
      'columnId',
    ],
    [
      '非字串的描述',
      { columnId: COLUMN_ID, title: '標題', description: 123 },
      'description',
    ],
  ])('拒絕%s', async (_label, input, field) => {
    // Act
    const { errors } = await validateAddCard(input);

    // Assert
    expect(errorFields(errors)).toEqual([field]);
  });

  it('200 字的標題與 5000 字的描述剛好通過', async () => {
    // Arrange
    const input = {
      columnId: COLUMN_ID,
      title: 'a'.repeat(200),
      description: 'a'.repeat(5000),
    };

    // Act
    const { errors } = await validateAddCard(input);

    // Assert
    expect(errors).toHaveLength(0);
  });

  it('拒絕 contract 未定義的欄位', async () => {
    // Arrange
    const input = { columnId: COLUMN_ID, title: '標題', position: 1 };

    // Act
    const { errors } = await validateAddCard(input);

    // Assert
    expect(errorFields(errors)).toEqual(['position']);
  });
});
