import { SessionGuard } from '@/session/session.guard';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/createProject.dto';
import type { ApiResult } from '@kanban/contracts/api';
import { AddProjectMemberDto } from './dto/addProjectMember.dto';

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
import type {
  MemberCandidate,
  ProjectListItemDto,
  ProjectMemberAddedNotificationDetail,
  ProjectMemberDto,
} from '@kanban/contracts/project';

@ApiTags('Projects')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Session 不存在或已失效' })
@UseGuards(SessionGuard)
@Controller('project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  // #region 建立專案
  @ApiOperation({ summary: '在指定工作區建立專案' })
  @ApiCreatedResponse({ description: '專案建立成功，建立者成為專案 OWNER' })
  @ApiBadRequestResponse({ description: '請求欄位驗證失敗或工作區已封存' })
  @ApiNotFoundResponse({
    description: '工作區不存在或目前使用者不是工作區成員',
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createProject(
    @Req() req: Request,
    @Body() createProjectDto: CreateProjectDto,
  ): Promise<ApiResult<null>> {
    await this.projectService.createProject(createProjectDto, req.userId!);
    return {
      data: null,
      message: '創建成功',
    };
  }

  // #endregion

  // #region 取得可加入專案的 Workspace 成員候選
  @ApiOperation({ summary: '取得新增專案成員的候選清單' })
  @ApiParam({
    name: 'projectId',
    description: '專案 UUID v4',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: '回傳同 Workspace 成員及其目前 Project role',
  })
  @ApiForbiddenResponse({
    description: '不是專案 OWNER、專案或工作區已封存',
  })
  @Get(':projectId/memberCandidates')
  async getMemberCandidates(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: Request,
  ): Promise<ApiResult<MemberCandidate[]>> {
    const result = await this.projectService.getMemberCandidates(
      req.userId!,
      projectId,
    );
    return { data: result };
  }
  // #endregion

  // #region 新增專案成員
  @ApiOperation({ summary: '將工作區成員加入專案' })
  @ApiCreatedResponse({ description: '專案成員新增成功並送出通知' })
  @ApiBadRequestResponse({ description: '請求欄位驗證失敗' })
  @ApiForbiddenResponse({ description: '不是專案 OWNER 或專案已封存' })
  @ApiNotFoundResponse({
    description: 'Workspace membership 不存在或不屬於該工作區',
  })
  @ApiConflictResponse({ description: '該使用者已是專案成員' })
  @Post('addMember')
  @HttpCode(HttpStatus.CREATED)
  async addProjectMember(
    @Req() req: Request,
    @Body() addProjectMemberDto: AddProjectMemberDto,
  ): Promise<ApiResult<null>> {
    await this.projectService.addProjectMember(
      addProjectMemberDto,
      req.userId!,
    );
    return {
      data: null,
      message: '新增專案成員成功',
    };
  }
  // #endregion

  // #region 取得單一專案的所有成員
  @Get(':projectId/members')
  async getListProjectMembers(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: Request,
  ): Promise<ApiResult<ProjectMemberDto[]>> {
    const result = await this.projectService.getSingleProjectMember(
      req.userId!,
      projectId,
    );
    return { data: result };
  }
  // #endregion

  // #region 取得使用者所屬的專案by workspaceId & userId
  @ApiOperation({ summary: '取得使用者在指定工作區所屬的專案' })
  @ApiParam({
    name: 'workspaceId',
    description: '工作區 UUID v4',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: '回傳目前使用者所屬且未封存的專案列表',
  })
  @ApiBadRequestResponse({
    description: 'workspaceId 格式錯誤或工作區已封存',
  })
  @ApiNotFoundResponse({
    description: '工作區不存在或目前使用者不是工作區成員',
  })
  @Get(':workspaceId')
  async getProjectsByWorkspaceIdAndUserId(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() req: Request,
  ): Promise<ApiResult<ProjectListItemDto[]>> {
    const result = await this.projectService.getProjectsByWorkspaceIdAndUserId(
      workspaceId,
      req.userId!,
    );
    return { data: result };
  }
  // #endregion

  // #region 取得專案加入成員通知的詳細資訊
  @Get('notificationDetail/:notificationId')
  async getAddedProjectMemberDetailNotification(
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @Req() req: Request,
  ): Promise<ApiResult<ProjectMemberAddedNotificationDetail>> {
    const result =
      await this.projectService.getProjectMemberAddedNotificationDetail(
        notificationId,
        req.userId!,
      );
    return { data: result };
  }
  // #endregion
}
