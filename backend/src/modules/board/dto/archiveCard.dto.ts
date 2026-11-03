import type { ArchiveCardRequest } from '@kanban/contracts/board';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class ArchiveCardDto implements ArchiveCardRequest {
  @ApiProperty({
    description: '要封存的 Card UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'cardId 格式不正確' })
  cardId!: string;

  @ApiProperty({
    description: '使用者看到的 version；不符時回 409',
    example: 3,
    minimum: 1,
  })
  @Min(1, { message: 'expectedVersion 必須大於 0' })
  @IsInt({ message: 'expectedVersion 必須是整數' })
  expectedVersion!: number;
}
