import {
  BOARD_COLUMN_COLOR_KEYS,
  type AddBoardColumnRequest,
  type BoardColumnColorKey,
} from '@kanban/contracts/board';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class AddBoardColumnDto implements AddBoardColumnRequest {
  @ApiProperty({
    description: '要新增欄位的 Project UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'projectId 格式不正確' })
  projectId!: string;

  @ApiProperty({
    description: 'BoardColumn 顯示名稱',
    example: '等待部署',
    maxLength: 80,
  })
  @Transform((params: TransformFnParams): unknown => {
    const rawValue: unknown = params.value;
    return typeof rawValue === 'string' ? rawValue.trim() : rawValue;
  })
  @MaxLength(80, { message: '欄位名稱不可超過 80 個字元' })
  @IsNotEmpty({ message: '欄位名稱不可為空' })
  @IsString({ message: '欄位名稱必須是字串' })
  title!: string;

  @ApiProperty({
    description: '欄位色票 key；只保存設計 token，不保存 CSS class 或色碼',
    enum: BOARD_COLUMN_COLOR_KEYS,
    example: 'mint',
  })
  @IsIn(BOARD_COLUMN_COLOR_KEYS, { message: '不支援此欄位顏色' })
  colorKey!: BoardColumnColorKey;
}
