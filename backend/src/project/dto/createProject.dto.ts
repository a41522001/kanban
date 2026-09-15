import type { CreateProjectRequest } from '@kanban/contracts/project';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateProjectDto implements CreateProjectRequest {
  @Transform((params: TransformFnParams): unknown => {
    const rawValue: unknown = params.value;
    return typeof rawValue === 'string' ? rawValue.trim() : rawValue;
  })
  @MaxLength(100, { message: '專案名稱不可超過 100 個字元' })
  @IsNotEmpty({ message: '專案名稱不可為空' })
  @IsString({ message: '專案名稱必須是字串' })
  name!: string;

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

  @IsUUID('4', { message: 'workspaceId 格式不正確' })
  @IsNotEmpty({ message: 'workspaceId 不可為空' })
  workspaceId!: string;
}
