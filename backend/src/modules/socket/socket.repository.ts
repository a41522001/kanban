import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SocketRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * 查詢使用者在專案中的成員資格與封存狀態，供加入 project room 前檢查。
   * 條件須與 BoardRepository 的看板讀取權限一致（有效成員含 VIEWER、Project 與 Workspace 未封存）。
   */
  findProjectMembership(userId: string, projectId: string) {
    return this.prismaService.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: {
        project: {
          select: {
            archivedAt: true,
            workspace: { select: { archivedAt: true } },
          },
        },
      },
    });
  }

  /**
   * 查詢使用者在工作區中的成員資格與封存狀態，供加入 workspace room 前檢查。
   * 條件須與 WorkspacesRepository.findMembership 一致（有效成員、Workspace 未封存）。
   */
  findWorkspaceMembership(userId: string, workspaceId: string) {
    return this.prismaService.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: {
        workspace: {
          select: {
            archivedAt: true,
          },
        },
      },
    });
  }
}
