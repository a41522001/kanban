import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { InviteMemberDto } from './dto/inviteMember.dto';
import { SessionGuard } from '@/session/session.guard';
import type { ApiResult } from '@kanban/contracts/api';
import { WorkspaceInvitationService } from './workspaceInvitation.service';
@UseGuards(SessionGuard)
@Controller('workspaceInvitation')
export class WorkspaceInvitationController {
  constructor(
    private readonly workspaceInvitationService: WorkspaceInvitationService,
  ) {}

  /** 邀請工作區成員 */
  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  async inviteMember(
    @Req() req: Request,
    @Body() inviteMemberDto: InviteMemberDto,
  ): Promise<ApiResult<null>> {
    await this.workspaceInvitationService.inviteMember(
      req.userId!,
      inviteMemberDto.workspaceId,
      inviteMemberDto.email,
    );

    return {
      data: null,
      message: '邀請已送出',
    };
  }
}
