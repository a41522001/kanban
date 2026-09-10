import type { AcceptOrDeclineInvitationRequest } from '@kanban/contracts/workspaceInvitation';
import { IsNotEmpty, IsUUID } from 'class-validator';
export class AcceptOrDeclineInvitationDto implements AcceptOrDeclineInvitationRequest {
  @IsUUID('4', { message: 'invitationId 格式不正確' })
  @IsNotEmpty({ message: 'invitationId 不可為空' })
  invitationId!: string;
}
