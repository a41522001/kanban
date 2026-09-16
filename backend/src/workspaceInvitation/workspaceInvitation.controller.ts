import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Param,
  Post,
  Req,
  UseGuards,
  Get,
} from '@nestjs/common';
import type { Request } from 'express';
import { InviteMemberDto } from './dto/inviteMember.dto';
import { SessionGuard } from '@/session/session.guard';
import type { ApiResult } from '@kanban/contracts/api';
import { WorkspaceInvitationService } from './workspaceInvitation.service';
import { AcceptOrDeclineInvitationDto } from './dto/acceptInvitation.dto';
import type { WorkspaceInvitationDetail } from '@kanban/contracts/workspaceInvitation';

import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Workspace Invitations')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Session 不存在或已失效' })
@UseGuards(SessionGuard)
@Controller('workspaceInvitation')
export class WorkspaceInvitationController {
  constructor(
    private readonly workspaceInvitationService: WorkspaceInvitationService,
  ) {}

  /** 邀請工作區成員 */
  @ApiOperation({ summary: '邀請已註冊使用者加入工作區' })
  @ApiCreatedResponse({ description: '邀請建立並送出通知' })
  @ApiBadRequestResponse({ description: '請求欄位驗證失敗或邀請自己' })
  @ApiForbiddenResponse({ description: '不是工作區擁有者或工作區已封存' })
  @ApiNotFoundResponse({ description: '受邀帳號不存在' })
  @ApiConflictResponse({ description: '對方已是成員或有效邀請已存在' })
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

  /** 接受工作區邀請 */
  @ApiOperation({ summary: '接受工作區邀請' })
  @ApiOkResponse({ description: '邀請已接受並建立工作區成員' })
  @ApiBadRequestResponse({ description: '請求欄位驗證失敗或工作區已封存' })
  @ApiNotFoundResponse({ description: '邀請不存在或不屬於目前使用者' })
  @ApiConflictResponse({ description: '邀請已失效、狀態已變更或已是成員' })
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @Req() req: Request,
    @Body() acceptOrDeclineInvitationDto: AcceptOrDeclineInvitationDto,
  ): Promise<ApiResult<null>> {
    await this.workspaceInvitationService.acceptedInvitationAndCreateMember(
      req.userId!,
      acceptOrDeclineInvitationDto.invitationId,
    );
    return { data: null, message: '已接受邀請' };
  }

  /** 拒絕工作區邀請 */
  @ApiOperation({ summary: '拒絕工作區邀請' })
  @ApiOkResponse({ description: '邀請已拒絕' })
  @ApiBadRequestResponse({ description: '請求欄位驗證失敗' })
  @ApiNotFoundResponse({ description: '邀請不存在或不屬於目前使用者' })
  @ApiConflictResponse({ description: '邀請已失效、狀態已變更或已是成員' })
  @Post('decline')
  @HttpCode(HttpStatus.OK)
  async declineInvitation(
    @Req() req: Request,
    @Body() acceptOrDeclineInvitationDto: AcceptOrDeclineInvitationDto,
  ): Promise<ApiResult<null>> {
    await this.workspaceInvitationService.declineInvitation(
      req.userId!,
      acceptOrDeclineInvitationDto.invitationId,
    );
    return { data: null, message: '已拒絕邀請' };
  }

  /** 取得工作區邀請詳細資訊 by workspaceInvitationId */
  @ApiOperation({ summary: '取得工作區邀請詳細資訊' })
  @ApiParam({
    name: 'workspaceInvitationId',
    description: '工作區邀請 UUID',
    format: 'uuid',
  })
  @ApiOkResponse({ description: '工作區邀請詳細資訊取得成功' })
  @ApiBadRequestResponse({ description: 'workspaceInvitationId 格式不正確' })
  @ApiNotFoundResponse({ description: '邀請不存在、已失效或不屬於目前使用者' })
  @Get(':workspaceInvitationId')
  @HttpCode(HttpStatus.OK)
  async getWorkspaceInvitationDetail(
    @Req() req: Request,
    @Param('workspaceInvitationId', ParseUUIDPipe)
    workspaceInvitationId: string,
  ): Promise<ApiResult<WorkspaceInvitationDetail>> {
    const result =
      await this.workspaceInvitationService.getWorkspaceInvitationDetail(
        workspaceInvitationId,
        req.userId!,
      );
    return { data: result };
  }
}
