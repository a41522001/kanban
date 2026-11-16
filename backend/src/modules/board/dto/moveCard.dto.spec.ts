import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { MoveCardDto } from './moveCard.dto';

const CARD_ID = '550e8400-e29b-41d4-a716-446655440000';
const COLUMN_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const AFTER_CARD_ID = '9b2f3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const validateMoveCard = async (
  input: Record<string, unknown>,
): Promise<ValidationError[]> => {
  const dto = plainToInstance(MoveCardDto, input);
  return validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  });
};

const errorFields = (errors: ValidationError[]) =>
  errors.map((error) => error.property);

describe('MoveCardDto', () => {
  it('接受 afterCardId 為 UUID', async () => {
    const errors = await validateMoveCard({
      cardId: CARD_ID,
      toColumnId: COLUMN_ID,
      afterCardId: AFTER_CARD_ID,
    });

    expect(errors).toHaveLength(0);
  });

  it('接受 afterCardId 為 null（放在最上面）', async () => {
    const errors = await validateMoveCard({
      cardId: CARD_ID,
      toColumnId: COLUMN_ID,
      afterCardId: null,
    });

    expect(errors).toHaveLength(0);
  });

  it.each([
    [
      '非 UUID v4 的 cardId',
      { cardId: 'card-1', toColumnId: COLUMN_ID, afterCardId: null },
      'cardId',
    ],
    ['缺少 toColumnId', { cardId: CARD_ID, afterCardId: null }, 'toColumnId'],
    [
      '非 UUID v4 的 afterCardId',
      { cardId: CARD_ID, toColumnId: COLUMN_ID, afterCardId: 'card-2' },
      'afterCardId',
    ],
    [
      '沒有送 afterCardId（必須明確送 null 才代表最上面）',
      { cardId: CARD_ID, toColumnId: COLUMN_ID },
      'afterCardId',
    ],
  ])('拒絕%s', async (_label, input, field) => {
    const errors = await validateMoveCard(input);

    expect(errorFields(errors)).toEqual([field]);
  });

  it('拒絕 contract 未定義的欄位（移動不帶 expectedVersion）', async () => {
    const errors = await validateMoveCard({
      cardId: CARD_ID,
      toColumnId: COLUMN_ID,
      afterCardId: null,
      expectedVersion: 3,
    });

    expect(errorFields(errors)).toEqual(['expectedVersion']);
  });
});
