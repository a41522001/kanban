import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import type { Request } from 'express';
import { CreateDto } from './dto/create.dto';
import { SessionGuard } from '@/session/session.guard';
import type {
  WorkspaceDto,
  WorkspaceListItemDto,
  WorkspaceMemberDto,
} from '@kanban/contracts/workspaces';
import type { ApiResult } from '@kanban/contracts/api';

import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Workspaces')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Session 不存在或已失效' })
@UseGuards(SessionGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  /** 創建工作區 */
  @ApiOperation({ summary: '建立工作區' })
  @ApiCreatedResponse({ description: '工作區建立成功' })
  @ApiBadRequestResponse({ description: '請求欄位驗證失敗' })
  @Post()
  async create(
    @Req() req: Request,
    @Body() createDto: CreateDto,
  ): Promise<ApiResult<WorkspaceDto>> {
    const result = await this.workspacesService.create(
      req.userId!,
      createDto.name,
    );
    return { data: result };
  }

  /** 取得目前使用者加入的工作區 */
  @ApiOperation({ summary: '取得目前使用者加入的工作區' })
  @ApiOkResponse({ description: '工作區列表取得成功' })
  @Get()
  async getListMyWorkspaces(
    @Req() req: Request,
  ): Promise<ApiResult<WorkspaceListItemDto[]>> {
    const result = await this.workspacesService.getByUserId(req.userId!);
    return { data: result };
  }

  /** 取得單一工作區的所有成員 */
  @ApiOperation({ summary: '取得指定工作區的成員列表' })
  @ApiParam({
    name: 'workspaceId',
    description: '工作區 UUID',
    format: 'uuid',
  })
  @ApiOkResponse({ description: '工作區成員列表取得成功' })
  @ApiBadRequestResponse({ description: 'workspaceId 格式不正確' })
  @ApiNotFoundResponse({ description: '工作區不存在或目前使用者無存取權' })
  @Get(':workspaceId/members')
  async getListWorkspaceMembers(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() req: Request,
  ): Promise<ApiResult<WorkspaceMemberDto[]>> {
    const result = await this.workspacesService.getSingleWorkspaceMember(
      req.userId!,
      workspaceId,
    );
    return { data: result };
  }
}
