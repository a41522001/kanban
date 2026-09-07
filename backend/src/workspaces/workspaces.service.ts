import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { WorkspacesRepository } from './workspaces.repository';
import type {
  WorkspaceDto,
  WorkspaceListItemDto,
  WorkspaceMemberDto,
} from '@kanban/contracts/workspaces';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import { UserService } from '@/user/user.service';
import { WorkspaceInvitationService } from '@/workspaceInvitation/workspaceInvitation.service';
import { DateTime } from 'luxon';
import { NotificationService } from '@/notification/notification.service';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly workspaceRepository: WorkspacesRepository,
    private readonly userService: UserService,
    private readonly workspaceInvitationService: WorkspaceInvitationService,
    private readonly notificationService: NotificationService,
    private readonly prismaService: PrismaService,
  ) {}

  /** 創建工作區 */
  async create(userId: string, name: string): Promise<WorkspaceDto> {
    const result = await this.workspaceRepository.create(userId, name);
    return {
      id: result.id,
      name: result.name,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  /** 取得使用者加入的工作區 */
  async getByUserId(userId: string): Promise<WorkspaceListItemDto[]> {
    const memberships = await this.workspaceRepository.getByUserId(userId);
    const result = memberships.map(({ role, workspace }) => {
      return {
        id: workspace.id,
        name: workspace.name,
        createdAt: workspace.createdAt.toISOString(),
        updatedAt: workspace.updatedAt.toISOString(),
        currentUserRole: role,
      };
    });
    return result;
  }

  /** 取得單一工作區的所有成員 */
  async getSingleWorkspaceMember(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMemberDto[]> {
    const membership = await this.workspaceRepository.findMembership(
      userId,
      workspaceId,
    );

    if (!membership || membership.workspace.archivedAt) {
      throw new NotFoundException('找不到工作區或你沒有存取權限');
    }

    const result =
      await this.workspaceRepository.getSingleWorkspaceMember(workspaceId);
    return result.map(({ id, role, user }) => {
      return {
        memberId: id,
        role: role,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      };
    });
  }

  /** 邀請成員 */
  async inviteMember(
    inviterUserId: string,
    workspaceId: string,
    inviteeEmail: string,
  ) {
    // 確認目前登入者是 Workspace Owner
    const member = await this.workspaceRepository.findMembership(
      inviterUserId,
      workspaceId,
    );
    if (!member || member.workspace.archivedAt || member.role !== 'OWNER') {
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
        code: ApiCode.RequestError,
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
    const existingMember = await this.workspaceRepository.findMembership(
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
    const pendingInvitation =
      await this.workspaceInvitationService.findPendingByWorkspaceAndInvitee(
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
      const expiredResult = await this.workspaceInvitationService.markExpired(
        pendingInvitation.id,
        now.toJSDate(),
      );
      if (expiredResult.count !== 1) {
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
      const newInvitation =
        await this.workspaceInvitationService.createInvitation(
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
          payload: {
            workspaceName: member.workspace.name,
            inviterDisplayName: member.user.displayName,
            role: 'MEMBER',
          },
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
