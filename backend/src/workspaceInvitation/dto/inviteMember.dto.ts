import type { InviteWorkspaceMemberRequest } from '@kanban/contracts/workspaceInvitation';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class InviteMemberDto implements InviteWorkspaceMemberRequest {
  @IsUUID('4', { message: 'workspaceId 格式不正確' })
  @IsNotEmpty({ message: 'workspaceId 不可為空' })
  workspaceId!: string;

  @Transform((params: TransformFnParams): unknown => {
    const rawValue: unknown = params.value;
    return typeof rawValue === 'string'
      ? rawValue.trim().toLowerCase()
      : rawValue;
  })
  @IsEmail({}, { message: 'Email 格式不正確' })
  @MaxLength(320, { message: 'Email 長度不可超過 320 個字元' })
  @IsString({ message: 'Email 必須是字串' })
  @IsNotEmpty({ message: 'Email 不可為空' })
  email!: string;
}
