import { HttpStatus, Injectable } from '@nestjs/common';
import { ProjectRepository } from './project.repository';
import { CreateProjectDto } from './dto/createProject.dto';
import { WorkspacesService } from '@/workspaces/workspaces.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ProjectService {
  constructor(
    private readonly workspaceService: WorkspacesService,
    private readonly prismaService: PrismaService,
    private readonly projectRepository: ProjectRepository,
  ) {}

  async createProject(createProjectDto: CreateProjectDto, userId: string) {
    const workspaceMember = await this.workspaceService.findMembership(
      userId,
      createProjectDto.workspaceId,
    );
    if (workspaceMember === null) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到此工作區',
        code: ApiCode.ResourceNotFound,
      });
    }
    if (workspaceMember.workspaceArchivedAt !== null) {
      throw new AppException({
        status: HttpStatus.BAD_REQUEST,
        message: '此工作區已被封存',
        code: ApiCode.RequestError,
      });
    }

    await this.prismaService.$transaction(async (tx) => {
      const project = await this.projectRepository.createProject(
        createProjectDto,
        userId,
        tx,
      );
      await this.projectRepository.addProjectMember(
        {
          projectId: project.id,
          role: 'OWNER',
          userId: userId,
        },
        tx,
      );
    });
  }
}
