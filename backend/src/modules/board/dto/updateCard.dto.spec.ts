import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { UpdateCardDto } from './updateCard.dto';

const CARD_ID = '550e8400-e29b-41d4-a716-446655440000';

const validateUpdateCard = async (
  input: Record<string, unknown>,
): Promise<{ dto: UpdateCardDto; errors: ValidationError[] }> => {
  const dto = plainToInstance(UpdateCardDto, input);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  });

  return { dto, errors };
};

const errorFields = (errors: ValidationError[]) =>
  errors.map((error) => error.property);

describe('UpdateCardDto', () => {
  it('接受標題與描述，並移除前後空白', async () => {
    // Arrange
    const input = {
      cardId: CARD_ID,
      title: '  新標題  ',
      description: '  新描述  ',
      expectedVersion: 3,
    };

    // Act
    const { dto, errors } = await validateUpdateCard(input);

    // Assert
    expect(errors).toHaveLength(0);
    expect(dto.title).toBe('新標題');
    expect(dto.description).toBe('新描述');
  });

  it('沒送的欄位維持 undefined，代表不改', async () => {
    // Arrange
    const input = { cardId: CARD_ID, title: '新標題', expectedVersion: 1 };

    // Act
    const { dto, errors } = await validateUpdateCard(input);

    // Assert
    expect(errors).toHaveLength(0);
    expect(dto.description).toBeUndefined();
  });

  it('只有空白的描述 trim 後為空字串，代表清空', async () => {
    // Arrange
    const input = { cardId: CARD_ID, description: '   ', expectedVersion: 1 };

    // Act
    const { dto, errors } = await validateUpdateCard(input);

    // Assert
    expect(errors).toHaveLength(0);
    expect(dto.description).toBe('');
  });

  it('標題與描述都沒送時 DTO 仍通過（由 service 回 400）', async () => {
    // Arrange
    const input = { cardId: CARD_ID, expectedVersion: 1 };

    // Act
    const { errors } = await validateUpdateCard(input);

    // Assert
    expect(errors).toHaveLength(0);
  });

  it.each([
    [
      '只有空白的標題（不能清空標題）',
      { cardId: CARD_ID, title: '   ', expectedVersion: 1 },
      'title',
    ],
    [
      '超過 200 字的標題',
      { cardId: CARD_ID, title: 'a'.repeat(201), expectedVersion: 1 },
      'title',
    ],
    [
      '超過 5000 字的描述',
      { cardId: CARD_ID, description: 'a'.repeat(5001), expectedVersion: 1 },
      'description',
    ],
    [
      '非 UUID v4 的 cardId',
      { cardId: 'card-1', title: '標題', expectedVersion: 1 },
      'cardId',
    ],
    [
      '缺少 expectedVersion',
      { cardId: CARD_ID, title: '標題' },
      'expectedVersion',
    ],
    [
      '非整數的 expectedVersion',
      { cardId: CARD_ID, title: '標題', expectedVersion: 1.5 },
      'expectedVersion',
    ],
    [
      '小於 1 的 expectedVersion',
      { cardId: CARD_ID, title: '標題', expectedVersion: 0 },
      'expectedVersion',
    ],
    [
      '字串形式的 expectedVersion',
      { cardId: CARD_ID, title: '標題', expectedVersion: '3' },
      'expectedVersion',
    ],
  ])('拒絕%s', async (_label, input, field) => {
    // Act
    const { errors } = await validateUpdateCard(input);

    // Assert
    expect(errorFields(errors)).toEqual([field]);
  });

  it('拒絕 contract 未定義的欄位', async () => {
    // Arrange
    const input = {
      cardId: CARD_ID,
      title: '標題',
      expectedVersion: 1,
      columnId: CARD_ID,
    };

    // Act
    const { errors } = await validateUpdateCard(input);

    // Assert
    expect(errorFields(errors)).toEqual(['columnId']);
  });
});
