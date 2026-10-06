import type { CreateProjectRequest } from '@kanban/contracts/project';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateProjectDto implements CreateProjectRequest {
  @ApiProperty({
    description: '專案名稱',
    example: 'Kanban MVP',
    maxLength: 100,
  })
  @Transform((params: TransformFnParams): unknown => {
    const rawValue: unknown = params.value;
    return typeof rawValue === 'string' ? rawValue.trim() : rawValue;
  })
  @MaxLength(100, { message: '專案名稱不可超過 100 個字元' })
  @IsNotEmpty({ message: '專案名稱不可為空' })
  @IsString({ message: '專案名稱必須是字串' })
  name!: string;

  @ApiPropertyOptional({
    description: '專案描述；空字串會轉為未提供',
    example: '完成第一版多人協作看板',
    maxLength: 500,
  })
  @Transform((params: TransformFnParams): unknown => {
    const rawValue: unknown = params.value;
    if (typeof rawValue !== 'string') {
      return rawValue;
    }

    const description = rawValue.trim();
    return description.length > 0 ? description : undefined;
  })
  @IsOptional()
  @MaxLength(500, { message: '專案描述不可超過 500 個字元' })
  @IsString({ message: '專案描述必須是字串' })
  description?: string | undefined;

  @ApiProperty({
    description: '所屬工作區 UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'workspaceId 格式不正確' })
  @IsNotEmpty({ message: 'workspaceId 不可為空' })
  workspaceId!: string;
}
