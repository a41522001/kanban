import type { AddProjectMemberRequest } from '@kanban/contracts/project';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

export class AddProjectMemberDto implements AddProjectMemberRequest {
  @ApiProperty({
    description: '要加入成員的專案 UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4')
  projectId!: string;

  @ApiProperty({
    description: '要加入專案的 Workspace membership UUID',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid',
  })
  @IsUUID('4')
  workspaceMemberId!: string;

  @ApiProperty({
    description: '新成員的專案角色',
    enum: ['EDITOR', 'VIEWER'],
    example: 'EDITOR',
  })
  @IsIn(['EDITOR', 'VIEWER'])
  role!: 'EDITOR' | 'VIEWER';
}
