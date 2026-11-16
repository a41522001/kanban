import type { MoveBoardColumnRequest } from '@kanban/contracts/board';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class MoveBoardColumnDto implements MoveBoardColumnRequest {
  @ApiProperty({
    description: '要移動的欄位 UUID',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'columnId 格式不正確' })
  columnId!: string;

  @ApiProperty({
    description:
      '放在這個欄位後面；null 代表放在最前面。必須明確送出（不送回 400）',
    example: null,
    format: 'uuid',
    nullable: true,
    type: String,
  })
  // null skips the check (first position); a missing field is undefined and still fails IsUUID.
  @ValidateIf((dto: MoveBoardColumnDto) => dto.afterColumnId !== null)
  @IsUUID('4', { message: 'afterColumnId 必須是 UUID 或 null' })
  afterColumnId!: string | null;
}
