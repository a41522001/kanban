import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import type { WorkspaceInvitationStatus } from '@kanban/contracts/workspaceInvitation';
import { CreateInvitationParams } from './workspaceInvitation.type';
@Injectable()
export class WorkspaceInvitationRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /** 取得工作區所有成員的邀請*/
  async getMemberInvitationByWorkspace(
    workspaceId: string,
    status?: WorkspaceInvitationStatus,
  ) {
    const where: Prisma.WorkspaceInvitationWhereInput = {
      workspaceId,
    };
    if (status) {
      where.status = status;
    }
    const result = await this.prismaService.workspaceInvitation.findMany({
      where: where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return result;
  }

  /** 尋找Status為 PENDING的資料 by workspaceId & invitee */
  async findPendingByWorkspaceAndInvitee(
    workspaceId: string,
    inviteeUserId: string,
  ) {
    return await this.prismaService.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        inviteeUserId,
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /** 標記邀請為過期 */
  async markExpired(
    invitationId: string,
    now: Date,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prismaService;
    return db.workspaceInvitation.updateMany({
      where: {
        id: invitationId,
        status: 'PENDING',
        expiresAt: {
          lte: now,
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });
  }

  /** 創建新邀請 */
  async createInvitation(
    data: CreateInvitationParams,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prismaService;
    return await db.workspaceInvitation.create({
      data: data,
    });
  }
}
