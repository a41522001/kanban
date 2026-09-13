import type { MarkReadRequest } from '@kanban/contracts/notification';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class MarkReadDto implements MarkReadRequest {
  @IsUUID('4', { message: 'notificationId 格式不正確' })
  @IsNotEmpty({ message: 'notificationId 不可為空' })
  notificationId!: string;
}
