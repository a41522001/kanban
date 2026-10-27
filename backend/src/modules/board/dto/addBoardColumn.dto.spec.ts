import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { AddBoardColumnDto } from './addBoardColumn.dto';

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';

const validateAddBoardColumn = async (
  input: Record<string, unknown>,
): Promise<{ dto: AddBoardColumnDto; errors: ValidationError[] }> => {
  const dto = plainToInstance(AddBoardColumnDto, input);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  });

  return { dto, errors };
};

describe('AddBoardColumnDto', () => {
  it('接受 contract 色票並移除欄位名稱前後空白', async () => {
    // Arrange
    const input = {
      projectId: PROJECT_ID,
      title: '  等待部署  ',
      colorKey: 'mint',
    };

    // Act
    const { dto, errors } = await validateAddBoardColumn(input);

    // Assert
    expect(errors).toHaveLength(0);
    expect(dto.title).toBe('等待部署');
    expect(dto.colorKey).toBe('mint');
  });

  it('拒絕 contract 未定義的欄位顏色', async () => {
    // Arrange
    const input = {
      projectId: PROJECT_ID,
      title: '等待部署',
      colorKey: 'red',
    };

    // Act
    const { errors } = await validateAddBoardColumn(input);

    // Assert
    expect(errors[0]?.property).toBe('colorKey');
    expect(errors[0]?.constraints).toEqual({
      isIn: '不支援此欄位顏色',
    });
  });

  it('拒絕空白欄位名稱', async () => {
    // Arrange
    const input = {
      projectId: PROJECT_ID,
      title: '   ',
      colorKey: 'coral',
    };

    // Act
    const { errors } = await validateAddBoardColumn(input);

    // Assert
    expect(errors[0]?.constraints).toEqual({
      isNotEmpty: '欄位名稱不可為空',
    });
  });

  it('拒絕超過 80 個字元的欄位名稱', async () => {
    // Arrange
    const input = {
      projectId: PROJECT_ID,
      title: 'x'.repeat(81),
      colorKey: 'coral',
    };

    // Act
    const { errors } = await validateAddBoardColumn(input);

    // Assert
    expect(errors[0]?.constraints).toEqual({
      maxLength: '欄位名稱不可超過 80 個字元',
    });
  });

  it('拒絕非 UUID projectId', async () => {
    // Arrange
    const input = {
      projectId: 'not-a-uuid',
      title: '等待部署',
      colorKey: 'amber',
    };

    // Act
    const { errors } = await validateAddBoardColumn(input);

    // Assert
    expect(errors[0]?.constraints).toEqual({
      isUuid: 'projectId 格式不正確',
    });
  });

  it('拒絕 DTO 未定義欄位', async () => {
    // Arrange
    const input = {
      projectId: PROJECT_ID,
      title: '等待部署',
      colorKey: 'amber',
      hex: '#ffffff',
    };

    // Act
    const { errors } = await validateAddBoardColumn(input);

    // Assert
    expect(errors[0]?.constraints).toEqual({
      whitelistValidation: 'property hex should not exist',
    });
  });
});
