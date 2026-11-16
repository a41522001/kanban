import {
  CARD_CATEGORY_COLOR_KEYS,
  type AddCategoryRequest,
  type CardCategoryColorKey,
} from '@kanban/contracts/board';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { trimString } from './transforms';

export class AddCategoryDto implements AddCategoryRequest {
  @ApiProperty({
    description: '類別所屬的 Project UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'projectId 格式不正確' })
  projectId!: string;

  @ApiProperty({
    description: '類別名稱；trim 後 1–20 字，同一專案內不分大小寫不可重複',
    example: '後端',
    maxLength: 20,
  })
  @Transform(trimString)
  @MaxLength(20, { message: '類別名稱不可超過 20 個字元' })
  @IsNotEmpty({ message: '類別名稱不可為空' })
  @IsString({ message: '類別名稱必須是字串' })
  name!: string;

  @ApiProperty({
    description: '類別色票 key',
    enum: CARD_CATEGORY_COLOR_KEYS,
    example: 'mint',
  })
  @IsIn(CARD_CATEGORY_COLOR_KEYS, { message: '類別顏色不正確' })
  colorKey!: CardCategoryColorKey;
}
