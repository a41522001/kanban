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

@UseGuards(SessionGuard)
@Controller('project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  /** 建立專案 */
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
}
