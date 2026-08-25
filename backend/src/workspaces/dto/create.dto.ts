import type { CreateWorkspaceDto } from '@kanban/contracts/workspaces';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateDto implements CreateWorkspaceDto {
  @Transform((params: TransformFnParams): unknown => {
    const rawValue: unknown = params.value;
    return typeof rawValue === 'string' ? rawValue.trim() : rawValue;
  })
  @MaxLength(100, { message: '工作區名稱不可超過 100 個字元' })
  @IsNotEmpty({ message: '工作區名稱不可為空' })
  @IsString({ message: '工作區名稱必須是字串' })
  name!: string;
}
