import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { CreateProjectDto } from './dto/createProject.dto';
import type { Prisma, Project, ProjectMember } from '@/generated/prisma/client';
import type { AddProjectMemberParams } from './project.type';

@Injectable()
export class ProjectRepository {
  constructor(private readonly prismaService: PrismaService) {}
  /** 創建專案 */
  async createProject(
    createProjectDto: CreateProjectDto,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Project> {
    const db = tx ?? this.prismaService;
    const { name, description, workspaceId } = createProjectDto;
    const result = await db.project.create({
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
  async getProjectsByWorkspaceId(
    workspaceId: string,
    userId: string,
  ): Promise<Project[]> {
    const result = await this.prismaService.project.findMany({
      where: {
        workspaceId,
        archivedAt: null,
        members: {
          some: {
            userId,
          },
        },
        workspace: {
          archivedAt: null,
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    return result;
  }

  /** 取得所有專案及底下的成員by workspaceId */
  async getProjectsWithMembersByWorkspaceId(workspaceId: string) {
    const result = await this.prismaService.project.findMany({
      where: {
        workspaceId,
        archivedAt: null,
        workspace: {
          archivedAt: null,
        },
      },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        description: true,
        status: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        members: {
          select: {
            userId: true,
            role: true,
            joinedAt: true,
            user: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    return result;
  }

  /** 創建專案成員 */
  async addProjectMember(
    data: AddProjectMemberParams,
    tx?: Prisma.TransactionClient,
  ): Promise<ProjectMember> {
    const db = tx ?? this.prismaService;
    const result = await db.projectMember.create({
      data,
    });
    return result;
  }
}
