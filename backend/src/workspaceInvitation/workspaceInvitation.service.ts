import { Injectable } from '@nestjs/common';
import { WorkspaceInvitationRepository } from './workspaceInvitation.repository';
import { WorkspaceInvitationStatus } from '@kanban/contracts/workspaceInvitation';
import type { Prisma } from '@/generated/prisma/client';
import { CreateInvitationParams } from './workspaceInvitation.type';

@Injectable()
export class WorkspaceInvitationService {
  constructor(
    private readonly workspaceInvitationRepository: WorkspaceInvitationRepository,
  ) {}
  /** 取得工作區所有成員的邀請*/
  async getMemberInvitationByWorkspace(
    workspaceId: string,
    status?: WorkspaceInvitationStatus,
  ) {
    const result =
      await this.workspaceInvitationRepository.getMemberInvitationByWorkspace(
        workspaceId,
        status,
      );
    return result;
  }

  /** 尋找Status為 PENDING的資料 by workspaceId & invitee */
  async findPendingByWorkspaceAndInvitee(
    workspaceId: string,
    inviteeUserId: string,
  ) {
    const result =
      await this.workspaceInvitationRepository.findPendingByWorkspaceAndInvitee(
        workspaceId,
        inviteeUserId,
      );
    return result;
  }

  /** 標記為過期 */
  async markExpired(
    invitationId: string,
    now: Date,
    tx?: Prisma.TransactionClient,
  ) {
    return this.workspaceInvitationRepository.markExpired(
      invitationId,
      now,
      tx,
    );
  }

  /** 創建新邀請 */
  async createInvitation(
    data: CreateInvitationParams,
    tx?: Prisma.TransactionClient,
  ) {
    return this.workspaceInvitationRepository.createInvitation(data, tx);
  }
}
