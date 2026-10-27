import type { AcceptOrDeclineInvitationRequest } from '@kanban/contracts/workspaceInvitation';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
export class AcceptOrDeclineInvitationDto implements AcceptOrDeclineInvitationRequest {
  @ApiProperty({
    description: '工作區邀請 UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'invitationId 格式不正確' })
  @IsNotEmpty({ message: 'invitationId 不可為空' })
  invitationId!: string;
}
