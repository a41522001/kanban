import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { MoveBoardColumnDto } from './moveBoardColumn.dto';

const COLUMN_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const AFTER_COLUMN_ID = '9b2f3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const validateMoveColumn = async (
  input: Record<string, unknown>,
): Promise<ValidationError[]> => {
  const dto = plainToInstance(MoveBoardColumnDto, input);
  return validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  });
};

const errorFields = (errors: ValidationError[]) =>
  errors.map((error) => error.property);

describe('MoveBoardColumnDto', () => {
  it('接受 afterColumnId 為 UUID', async () => {
    const errors = await validateMoveColumn({
      columnId: COLUMN_ID,
      afterColumnId: AFTER_COLUMN_ID,
    });

    expect(errors).toHaveLength(0);
  });

  it('接受 afterColumnId 為 null（放在最前面）', async () => {
    const errors = await validateMoveColumn({
      columnId: COLUMN_ID,
      afterColumnId: null,
    });

    expect(errors).toHaveLength(0);
  });

  it.each([
    [
      '非 UUID v4 的 columnId',
      { columnId: 'column-1', afterColumnId: null },
      'columnId',
    ],
    ['缺少 columnId', { afterColumnId: null }, 'columnId'],
    [
      '非 UUID v4 的 afterColumnId',
      { columnId: COLUMN_ID, afterColumnId: 'column-2' },
      'afterColumnId',
    ],
    [
      '沒有送 afterColumnId（必須明確送 null 才代表最前面）',
      { columnId: COLUMN_ID },
      'afterColumnId',
    ],
  ])('拒絕%s', async (_label, input, field) => {
    const errors = await validateMoveColumn(input);

    expect(errorFields(errors)).toEqual([field]);
  });

  it.each([
    ['projectId', { projectId: COLUMN_ID }],
    ['beforeColumnId', { beforeColumnId: null }],
    ['expectedBoardRevision', { expectedBoardRevision: '3' }],
  ])(
    '拒絕舊佔位格式的欄位 %s（Board 規格 §8.3 已移除）',
    async (field, extra) => {
      const errors = await validateMoveColumn({
        columnId: COLUMN_ID,
        afterColumnId: null,
        ...extra,
      });

      expect(errorFields(errors)).toEqual([field]);
    },
  );
});
