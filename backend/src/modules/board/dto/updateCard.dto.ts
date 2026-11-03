import type { UpdateCardRequest } from '@kanban/contracts/board';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { trimString } from './transforms';

// 「標題與描述至少送一個」由 service 檢查，回 400 / ValidationError。
export class UpdateCardDto implements UpdateCardRequest {
  @ApiProperty({
    description: '要編輯的 Card UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'cardId 格式不正確' })
  cardId!: string;

  @ApiPropertyOptional({
    description: '新的卡片標題；不送代表不改，有送時不可為空',
    example: '建立看板 API',
    maxLength: 200,
  })
  @IsOptional()
  @Transform(trimString)
  @MaxLength(200, { message: '卡片標題不可超過 200 個字元' })
  @IsNotEmpty({ message: '卡片標題不可為空' })
  @IsString({ message: '卡片標題必須是字串' })
  title?: string;

  @ApiPropertyOptional({
    description: '新的卡片描述；不送代表不改，空字串或只有空白代表清空',
    example: '完成新增、編輯與封存卡片的 API。',
    maxLength: 5000,
  })
  @IsOptional()
  @Transform(trimString)
  @MaxLength(5000, { message: '卡片描述不可超過 5000 個字元' })
  @IsString({ message: '卡片描述必須是字串' })
  description?: string;

  @ApiProperty({
    description: '使用者開始編輯時看到的 version；不符時回 409',
    example: 3,
    minimum: 1,
  })
  @Min(1, { message: 'expectedVersion 必須大於 0' })
  @IsInt({ message: 'expectedVersion 必須是整數' })
  expectedVersion!: number;
}
