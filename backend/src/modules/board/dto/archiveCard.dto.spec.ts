import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { ArchiveCardDto } from './archiveCard.dto';

const CARD_ID = '550e8400-e29b-41d4-a716-446655440000';

const validateArchiveCard = async (
  input: Record<string, unknown>,
): Promise<ValidationError[]> => {
  const dto = plainToInstance(ArchiveCardDto, input);
  return validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  });
};

const errorFields = (errors: ValidationError[]) =>
  errors.map((error) => error.property);

describe('ArchiveCardDto', () => {
  it('接受 cardId 與 expectedVersion', async () => {
    // Act
    const errors = await validateArchiveCard({
      cardId: CARD_ID,
      expectedVersion: 3,
    });

    // Assert
    expect(errors).toHaveLength(0);
  });

  it.each([
    [
      '非 UUID v4 的 cardId',
      { cardId: 'card-1', expectedVersion: 1 },
      'cardId',
    ],
    ['缺少 expectedVersion', { cardId: CARD_ID }, 'expectedVersion'],
    [
      '小於 1 的 expectedVersion',
      { cardId: CARD_ID, expectedVersion: 0 },
      'expectedVersion',
    ],
    [
      '字串形式的 expectedVersion',
      { cardId: CARD_ID, expectedVersion: '3' },
      'expectedVersion',
    ],
  ])('拒絕%s', async (_label, input, field) => {
    // Act
    const errors = await validateArchiveCard(input);

    // Assert
    expect(errorFields(errors)).toEqual([field]);
  });

  it('拒絕 contract 未定義的欄位（封存不接受內容修改）', async () => {
    // Act
    const errors = await validateArchiveCard({
      cardId: CARD_ID,
      expectedVersion: 1,
      title: '順便改標題',
    });

    // Assert
    expect(errorFields(errors)).toEqual(['title']);
  });
});
