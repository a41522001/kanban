import type { MoveCardRequest } from '@kanban/contracts/board';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class MoveCardDto implements MoveCardRequest {
  @ApiProperty({
    description: '要移動的 Card UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'cardId 格式不正確' })
  cardId!: string;

  @ApiProperty({
    description: '目標欄位 UUID；可以是卡片目前所在的欄位',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'toColumnId 格式不正確' })
  toColumnId!: string;

  @ApiProperty({
    description:
      '放在這張卡片後面；null 代表放在最上面。必須明確送出（不送回 400）',
    example: null,
    format: 'uuid',
    nullable: true,
    type: String,
  })
  // null skips the check (top of the column); a missing field is undefined and still fails IsUUID.
  @ValidateIf((dto: MoveCardDto) => dto.afterCardId !== null)
  @IsUUID('4', { message: 'afterCardId 必須是 UUID 或 null' })
  afterCardId!: string | null;
}
