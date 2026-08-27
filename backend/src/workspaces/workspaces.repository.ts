import type { Prisma, Workspace } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
type WorkspaceMembershipWithWorkspace = Prisma.WorkspaceMemberGetPayload<{
  select: {
    role: true;
    workspace: {
      select: {
        id: true;
        name: true;
        createdAt: true;
        updatedAt: true;
      };
    };
  };
}>;
type WorkspaceMemberResponse = Prisma.WorkspaceMemberGetPayload<{
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
export class WorkspacesRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /** 新增工作區，並將建立者設為 OWNER */
  async create(userId: string, name: string): Promise<Workspace> {
    const result = await this.prismaService.workspace.create({
      data: {
        createdById: userId,
        name,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
    });
    return result;
  }

  /** 取得使用者加入的工作區 */
  async getByUserId(
    userId: string,
  ): Promise<WorkspaceMembershipWithWorkspace[]> {
    const result = await this.prismaService.workspaceMember.findMany({
      where: {
        userId,
        workspace: {
          archivedAt: null,
        },
      },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: [
        {
          workspace: {
            updatedAt: 'desc',
          },
        },
        {
          workspaceId: 'desc',
        },
      ],
    });
    return result;
  }

  /** 取得單一工作區的所有成員 */
  async getSingleWorkspaceMember(
    workspaceId: string,
  ): Promise<WorkspaceMemberResponse[]> {
    const result = await this.prismaService.workspaceMember.findMany({
      where: {
        workspaceId,
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
