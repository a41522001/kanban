import type { InviteWorkspaceMemberRequest } from '@kanban/contracts/workspaceInvitation';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class InviteMemberDto implements InviteWorkspaceMemberRequest {
  @ApiProperty({
    description: '要加入的工作區 UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'workspaceId 格式不正確' })
  @IsNotEmpty({ message: 'workspaceId 不可為空' })
  workspaceId!: string;

  @ApiProperty({
    description: '受邀使用者的註冊 Email',
    example: 'member@example.com',
    maxLength: 320,
  })
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
