import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { CreateProjectDto } from './dto/createProject.dto';
import type { Prisma, Project, ProjectMember } from '@/generated/prisma/client';
import type { AddProjectMemberParams } from './project.type';
import type { MemberCandidate } from '@kanban/contracts/project';
type ProjectMemberResponse = Prisma.ProjectMemberGetPayload<{
  select: {
    id: true;
    role: true;
    user: {
      select: {
        displayName: true;
        avatarUrl: true;
      };
    };
  };
}>;

@Injectable()
export class ProjectRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /** 取得新增成員的候選 */
  async getMemberCandidates(projectId: string): Promise<MemberCandidate[]> {
    return this.prismaService.$queryRaw<MemberCandidate[]>`
      SELECT
        wm.id AS "workspaceMemberId",
        u.display_name AS "displayName",
        u.avatar_url AS "avatarUrl",
        pm.role AS "projectRole"
      FROM projects AS p
      JOIN workspaces AS w
        ON w.id = p.workspace_id
        AND w.archived_at IS NULL
      JOIN workspace_members AS wm
        ON wm.workspace_id = p.workspace_id
      JOIN users AS u
        ON u.id = wm.user_id
      LEFT JOIN project_members AS pm
        ON pm.project_id = p.id
        AND pm.user_id = wm.user_id
      WHERE p.id = ${projectId}::uuid
        AND p.archived_at IS NULL
      ORDER BY
        CASE WHEN pm.id IS NULL THEN 0 ELSE 1 END,
        u.display_name ASC
    `;
  }
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

  /** 取得所有專案by workspaceId & userId */
  async getProjectsByWorkspaceIdAndUserId(
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

  /** 新增專案成員 */
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

  /** 找尋成員關係 */
  async findMembership(userId: string, projectId: string) {
    return this.prismaService.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      select: {
        id: true,
        role: true,
        project: {
          select: {
            name: true,
            archivedAt: true,
            workspaceId: true,
            workspace: {
              select: {
                archivedAt: true,
              },
            },
          },
        },
        user: {
          select: {
            displayName: true,
          },
        },
      },
    });
  }

  async getProjectMemberAddedNotificationDetail(
    projectId: string,
    userId: string,
  ) {
    return this.prismaService.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      select: {
        role: true,
        joinedAt: true,
        project: {
          select: {
            id: true,
            name: true,
            archivedAt: true,
            workspaceId: true,
            workspace: {
              select: {
                id: true,
                name: true,
                archivedAt: true,
              },
            },
          },
        },
      },
    });
  }

  /** 取得單一專案的所有成員 */
  async getSingleProjectMember(
    projectId: string,
  ): Promise<ProjectMemberResponse[]> {
    const result = await this.prismaService.projectMember.findMany({
      where: {
        projectId,
      },
      select: {
        id: true,
        role: true,
        user: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
    return result;
  }
}
