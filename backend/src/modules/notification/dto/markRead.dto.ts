import type { MarkReadRequest } from '@kanban/contracts/notification';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class MarkReadDto implements MarkReadRequest {
  @ApiProperty({
    description: '要標示為已讀的通知 UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'notificationId 格式不正確' })
  @IsNotEmpty({ message: 'notificationId 不可為空' })
  notificationId!: string;
}
