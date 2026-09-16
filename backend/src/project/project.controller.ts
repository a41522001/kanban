import { SessionGuard } from '@/session/session.guard';
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
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Projects')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Session 不存在或已失效' })
@UseGuards(SessionGuard)
@Controller('project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  /** 建立專案 */
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

  /** 新增專案成員 */
  @ApiOperation({ summary: '將工作區成員加入專案' })
  @ApiCreatedResponse({ description: '專案成員新增成功並送出通知' })
  @ApiBadRequestResponse({ description: '請求欄位驗證失敗' })
  @ApiForbiddenResponse({ description: '不是專案 OWNER 或專案已封存' })
  @ApiNotFoundResponse({ description: '帳號不存在或不是該工作區的有效成員' })
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
}
