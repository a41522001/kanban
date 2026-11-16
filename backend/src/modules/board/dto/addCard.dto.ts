import type { AddCardRequest } from '@kanban/contracts/board';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { trimString } from './transforms';

export class AddCardDto implements AddCardRequest {
  @ApiProperty({
    description: '要新增卡片的 BoardColumn UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'columnId 格式不正確' })
  columnId!: string;

  @ApiProperty({
    description: '卡片標題',
    example: '建立看板 API',
    maxLength: 200,
  })
  @Transform(trimString)
  @MaxLength(200, { message: '卡片標題不可超過 200 個字元' })
  @IsNotEmpty({ message: '卡片標題不可為空' })
  @IsString({ message: '卡片標題必須是字串' })
  title!: string;

  @ApiPropertyOptional({
    description: '卡片描述；只有空白時視為沒有描述',
    example: '完成新增、編輯與封存卡片的 API。',
    maxLength: 5000,
  })
  @IsOptional()
  @Transform(trimString)
  @MaxLength(5000, { message: '卡片描述不可超過 5000 個字元' })
  @IsString({ message: '卡片描述必須是字串' })
  description?: string;

  @ApiPropertyOptional({
    description: '卡片類別的 UUID；必須屬於卡片所在專案，不送代表沒有類別',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'categoryId 格式不正確' })
  categoryId?: string;
}
