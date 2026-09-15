import type { AddProjectMemberRequest } from '@kanban/contracts/project';
import { IsEmail, IsIn, IsUUID, MaxLength } from 'class-validator';

export class AddProjectMemberDto implements AddProjectMemberRequest {
  @IsUUID('4')
  projectId!: string;

  @IsEmail()
  @MaxLength(320)
  memberEmail!: string;

  @IsIn(['EDITOR', 'VIEWER'])
  role!: 'EDITOR' | 'VIEWER';
}
