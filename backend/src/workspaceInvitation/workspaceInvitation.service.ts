import { HttpStatus, Injectable } from '@nestjs/common';
import { WorkspaceInvitationRepository } from './workspaceInvitation.repository';
import type {
  WorkspaceInvitationDetail,
  WorkspaceInvitationStatus,
} from '@kanban/contracts/workspaceInvitation';
import type { Prisma } from '@/generated/prisma/client';
import { CreateInvitationParams } from './workspaceInvitation.type';
import { WorkspacesService } from '@/workspaces/workspaces.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import { DateTime } from 'luxon';
import { UserService } from '@/user/user.service';
import { NotificationService } from '@/notification/notification.service';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class WorkspaceInvitationService {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
    private readonly prismaService: PrismaService,
    private readonly workspaceInvitationRepository: WorkspaceInvitationRepository,
  ) {}

  /** 取得工作區邀請詳細資訊 by workspaceInvitationId */
  async getWorkspaceInvitationDetail(
    workspaceInvitationId: string,
    userId: string,
  ): Promise<WorkspaceInvitationDetail> {
    const result = await this.workspaceInvitationRepository.getDetailById(
      workspaceInvitationId,
    );
    if (result === null) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到此工作區邀請',
        code: ApiCode.ResourceNotFound,
      });
    }

    if (result.inviteeUserId !== userId) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到此工作區邀請',
        code: ApiCode.ResourceNotFound,
      });
    }
    if (result.workspace.archivedAt !== null) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到此工作區邀請',
        code: ApiCode.ResourceNotFound,
      });
    }
    const now = DateTime.utc();

    const status =
      result.status === 'PENDING' &&
      DateTime.fromJSDate(result.expiresAt).toUTC() <= now
        ? 'EXPIRED'
        : result.status;
    return {
      invitationId: result.id,
      workspaceId: result.workspaceId,
      workspaceName: result.workspace.name,
      inviterName: result.inviter?.displayName ?? null,
      role: result.role,
      status,
      expiresAt: result.expiresAt.toISOString(),
      respondedAt: result.respondedAt?.toISOString() ?? null,
    };
  }

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

  /** 創建新邀請 */
  async createInvitation(
    data: CreateInvitationParams,
    tx?: Prisma.TransactionClient,
  ) {
    return this.workspaceInvitationRepository.createInvitation(data, tx);
  }

  /** 標記邀請為過期(全部) */
  async expirePendingInvitations(now: Date): Promise<number> {
    const result =
      await this.workspaceInvitationRepository.expirePendingInvitations(now);
    return result.count;
  }

  /** 標記為過期 */
  async markExpired(
    invitationId: string,
    now: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await this.workspaceInvitationRepository.markExpired(
      invitationId,
      now,
      tx,
    );
    return result.count;
  }

  /** 標記為接受 */
  async markAccepted(
    invitationId: string,
    inviteeUserId: string,
    now: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await this.workspaceInvitationRepository.markAccepted(
      invitationId,
      inviteeUserId,
      now,
      tx,
    );
    return result.count;
  }

  /** 標記為拒絕 */
  async markDeclined(
    invitationId: string,
    inviteeUserId: string,
    now: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await this.workspaceInvitationRepository.markDeclined(
      invitationId,
      inviteeUserId,
      now,
      tx,
    );
    return result.count;
  }

  /** 接受邀請並加入成員 */
  async acceptedInvitationAndCreateMember(
    userId: string,
    invitationId: string,
  ) {
    const invitation =
      await this.workspaceInvitationRepository.getById(invitationId);
    if (!invitation) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到此邀請',
        code: ApiCode.ResourceNotFound,
      });
    }

    // 確認目前登入者不存在於workspace
    const member = await this.workspacesService.findMembership(
      userId,
      invitation.workspaceId,
    );
    if (member) {
      throw new AppException({
        status: HttpStatus.CONFLICT,
        message: '此使用者已是工作區成員',
        code: ApiCode.RequestError,
      });
    }
    // 確定工作區是否存在和有無被封存
    const workspace = await this.workspacesService.getById(
      invitation.workspaceId,
    );
    if (!workspace || workspace.archivedAt !== null) {
      throw new AppException({
        status: HttpStatus.BAD_REQUEST,
        message: '此工作區已被封存',
        code: ApiCode.RequestError,
      });
    }
    await this.prismaService.$transaction(async (tx) => {
      const now = DateTime.utc();
      const count = await this.markAccepted(
        invitationId,
        userId,
        now.toJSDate(),
        tx,
      );
      if (count === 0) {
        throw new AppException({
          status: HttpStatus.CONFLICT,
          message: '邀請已失效或狀態已變更',
          code: ApiCode.RequestError,
        });
      }
      await this.workspacesService.joinMember(
        userId,
        invitation.workspaceId,
        tx,
      );
    });
  }

  /** 拒絕邀請 */
  async declineInvitation(userId: string, invitationId: string) {
    const invitation =
      await this.workspaceInvitationRepository.getById(invitationId);
    if (!invitation) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到此邀請',
        code: ApiCode.ResourceNotFound,
      });
    }
    // 確認目前登入者不存在於workspace
    const member = await this.workspacesService.findMembership(
      userId,
      invitation.workspaceId,
    );
    if (member) {
      throw new AppException({
        status: HttpStatus.CONFLICT,
        message: '此使用者已是工作區成員',
        code: ApiCode.RequestError,
      });
    }
    const now = DateTime.utc();
    const count = await this.markDeclined(invitationId, userId, now.toJSDate());
    if (count === 0) {
      throw new AppException({
        status: HttpStatus.CONFLICT,
        message: '邀請已失效或狀態已變更',
        code: ApiCode.RequestError,
      });
    }
  }

  /** 邀請成員 */
  async inviteMember(
    inviterUserId: string,
    workspaceId: string,
    inviteeEmail: string,
  ) {
    // 確認目前登入者是 Workspace Owner
    const member = await this.workspacesService.findMembership(
      inviterUserId,
      workspaceId,
    );
    if (!member || member.workspaceArchivedAt || member.role !== 'OWNER') {
      throw new AppException({
        status: HttpStatus.FORBIDDEN,
        message: '你沒有邀請此工作區成員的權限',
        code: ApiCode.RequestError,
      });
    }
    // 只允許邀請已註冊使用者
    const invitee = await this.userService.getByEmail(inviteeEmail);
    if (!invitee) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '此帳號不存在',
        code: ApiCode.ResourceNotFound,
      });
    }
    // 無法邀請自己
    const inviteeUserId = invitee.id;
    if (inviteeUserId === inviterUserId) {
      throw new AppException({
        status: HttpStatus.BAD_REQUEST,
        message: '無法邀請自己',
        code: ApiCode.RequestError,
      });
    }
    // 受邀者是否已是成員
    const existingMember = await this.workspacesService.findMembership(
      inviteeUserId,
      workspaceId,
    );
    if (existingMember) {
      throw new AppException({
        status: HttpStatus.CONFLICT,
        message: '此使用者已是工作區成員',
        code: ApiCode.RequestError,
      });
    }

    // 查看邀請是否存在或已過期
    const pendingInvitation = await this.findPendingByWorkspaceAndInvitee(
      workspaceId,
      inviteeUserId,
    );
    const now = DateTime.utc();
    if (pendingInvitation) {
      const invitationExpiresAt = DateTime.fromJSDate(
        pendingInvitation.expiresAt,
        { zone: 'utc' },
      );

      const isStillValid = invitationExpiresAt.toMillis() > now.toMillis();
      if (isStillValid) {
        throw new AppException({
          status: HttpStatus.CONFLICT,
          message: '已經邀請過此使用者',
          code: ApiCode.RequestError,
        });
      }
      // 邀請時間已過期 改狀態為過期
      const expiredResult = await this.markExpired(
        pendingInvitation.id,
        now.toJSDate(),
      );
      if (expiredResult !== 1) {
        throw new AppException({
          status: HttpStatus.CONFLICT,
          message: '邀請狀態已發生變更，請重新操作',
          code: ApiCode.RequestError,
        });
      }
    }
    // 創建新邀請以及新通知
    const expiresAt = now.plus({ days: 7 }).toJSDate();
    const invitation = await this.prismaService.$transaction(async (tx) => {
      const createInvitationParams = {
        workspaceId,
        inviteeUserId,
        inviterUserId,
        expiresAt,
      };
      const newInvitation = await this.createInvitation(
        createInvitationParams,
        tx,
      );
      await this.notificationService.createNotification(
        {
          recipientUserId: inviteeUserId,
          actorUserId: inviterUserId,
          workspaceId,
          type: 'WORKSPACE_INVITED',
          resourceType: 'WORKSPACE_INVITATION',
          resourceId: newInvitation.id,
          dedupeKey: `workspaceInvitation:${newInvitation.id}`,
          expiresAt,
        },
        tx,
      );
      return newInvitation;
    });

    return invitation;
  }
}
