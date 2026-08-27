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
import type { Request, Response } from 'express';
import { CreateDto } from './dto/create.dto';
import { SessionGuard } from '@/session/session.guard';
import type {
  WorkspaceDto,
  WorkspaceListItemDto,
  WorkspaceMemberDto,
} from '@kanban/contracts/workspaces';
import type { ApiResult } from '@kanban/contracts/api';
@UseGuards(SessionGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  /** 創建工作區 */
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
  @Get()
  async getListMyWorkspaces(
    @Req() req: Request,
  ): Promise<ApiResult<WorkspaceListItemDto[]>> {
    const result = await this.workspacesService.getByUserId(req.userId!);
    return { data: result };
  }

  /** 取得單一工作區的所有成員 */
  @Get(':workspaceId/members')
  async getListWorkspaceMembers(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ): Promise<ApiResult<WorkspaceMemberDto[]>> {
    const result =
      await this.workspacesService.getSingleWorkspaceMember(workspaceId);
    return { data: result };
  }
}
