import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { CreateProjectDto } from './dto/createProject.dto';

@Injectable()
export class ProjectRepository {
  constructor(private readonly prismaService: PrismaService) {}
  /** 新增專案 */
  async addProject(createProjectDto: CreateProjectDto, userId: string) {
    const { name, description, workspaceId } = createProjectDto;
    const result = await this.prismaService.project.create({
      data: {
        name,
        description,
        workspaceId,
        createdById: userId,
      },
    });
    return result;
  }

  /** 取得所有專案by workspaceId */
  async getProjectsByWorkspaceId(workspaceId: string) {
    const result = await this.prismaService.project.findMany({
      where: {
        workspaceId,
      },
    });
    return result;
  }
}
