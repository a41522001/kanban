import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRepository } from './project.repository';
import { CreateProjectDto } from './dto/createProject.dto';
import { WorkspacesService } from '@/workspaces/workspaces.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import { PrismaService } from '@/prisma/prisma.service';
import { AddProjectMemberDto } from './dto/addProjectMember.dto';
import { FindMembershipResponse } from './project.type';
import { NotificationService } from '@/notification/notification.service';
import { SocketService } from '@/socket/socket.service';
import { Prisma, type Notification } from '@/generated/prisma/client';
import type {
  MemberCandidate,
  ProjectListItemDto,
  ProjectMemberAddedNotificationDetail,
  ProjectMemberDto,
} from '@kanban/contracts/project';
import { DateTime } from 'luxon';
@Injectable()
export class ProjectService {
  constructor(
    private readonly workspaceService: WorkspacesService,
    private readonly notificationService: NotificationService,
    private readonly prismaService: PrismaService,
    private readonly socketService: SocketService,
    private readonly projectRepository: ProjectRepository,
  ) {}

  /** 取得所有專案by workspaceId & userId*/
  async getProjectsByWorkspaceIdAndUserId(
    workspaceId: string,
    userId: string,
  ): Promise<ProjectListItemDto[]> {
    const workspace = await this.workspaceService.findMembership(
      userId,
      workspaceId,
    );
    if (workspace === null) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到此工作區',
        code: ApiCode.ResourceNotFound,
      });
    }
    if (workspace.workspaceArchivedAt !== null) {
      throw new AppException({
        status: HttpStatus.BAD_REQUEST,
        message: '此工作區已被封存',
        code: ApiCode.RequestError,
      });
    }
    const projects =
      await this.projectRepository.getProjectsByWorkspaceIdAndUserId(
        workspaceId,
        userId,
      );
    return projects.map((item) => {
      const {
        name,
        id,
        workspaceId,
        description,
        status,
        createdAt,
        updatedAt,
        pinnedAt,
      } = item;
      return {
        name,
        id,
        workspaceId,
        description,
        status,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        pinnedAt: pinnedAt?.toISOString() ?? null,
      };
    });
  }

  /** 找尋成員 */
  async findMembership(
    userId: string,
    projectId: string,
  ): Promise<null | FindMembershipResponse> {
    const result = await this.projectRepository.findMembership(
      userId,
      projectId,
    );
    if (result === null) {
      return null;
    }

    return {
      memberId: result.id,
      memberName: result.user.displayName,
      role: result.role,
      projectName: result.project.name,
      projectArchivedAt: result.project.archivedAt,
      workspaceArchivedAt: result.project.workspace.archivedAt,
      workspaceId: result.project.workspaceId,
    };
  }

  /** 取得同 Workspace 中可加入目前 Project 的成員候選。 */
  async getMemberCandidates(
    userId: string,
    projectId: string,
  ): Promise<MemberCandidate[]> {
    const projectMembership = await this.findMembership(userId, projectId);

    if (
      !projectMembership ||
      projectMembership.role !== 'OWNER' ||
      projectMembership.projectArchivedAt !== null ||
      projectMembership.workspaceArchivedAt !== null
    ) {
      throw new AppException({
        status: HttpStatus.FORBIDDEN,
        message: '你沒有管理此專案成員的權限',
        code: ApiCode.RequestError,
      });
    }

    const workspaceMembership = await this.workspaceService.findMembership(
      userId,
      projectMembership.workspaceId,
    );

    if (
      !workspaceMembership ||
      workspaceMembership.workspaceArchivedAt !== null
    ) {
      throw new AppException({
        status: HttpStatus.FORBIDDEN,
        message: '你已不是此工作區的有效成員',
        code: ApiCode.RequestError,
      });
    }

    const candidates =
      await this.projectRepository.getMemberCandidates(projectId);

    // API 只公開 membership id；內部 User.id 不得傳到前端。
    return candidates.map(
      ({ workspaceMemberId, displayName, avatarUrl, projectRole }) => ({
        workspaceMemberId,
        displayName,
        avatarUrl,
        projectRole,
      }),
    );
  }

  /** 新增專案成員 */
  async addProjectMember(
    addProjectMemberDto: AddProjectMemberDto,
    inviterId: string,
  ) {
    const { projectId, workspaceMemberId, role } = addProjectMemberDto;
    const inviter = await this.findMembership(inviterId, projectId);

    if (
      inviter === null ||
      inviter.projectArchivedAt !== null ||
      inviter.workspaceArchivedAt !== null ||
      inviter.role !== 'OWNER'
    ) {
      throw new AppException({
        status: HttpStatus.FORBIDDEN,
        message: '你沒有邀請此專案成員的權限',
        code: ApiCode.RequestError,
      });
    }
    // 操作者與目標 membership 都必須仍屬於 Project 所在的有效 Workspace。
    const [workspaceInviterMember, workspaceInviteeMember] = await Promise.all([
      this.workspaceService.findMembership(inviterId, inviter.workspaceId),
      this.workspaceService.findMembershipById(workspaceMemberId),
    ]);
    if (
      !workspaceInviterMember ||
      !workspaceInviteeMember ||
      workspaceInviteeMember.workspaceId !== inviter.workspaceId ||
      workspaceInviterMember.workspaceArchivedAt !== null ||
      workspaceInviteeMember.workspaceArchivedAt !== null
    ) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到此工作區成員',
        code: ApiCode.ResourceNotFound,
      });
    }

    let newNotification: Notification;
    try {
      newNotification = await this.prismaService.$transaction(async (tx) => {
        const projectMember = await this.projectRepository.addProjectMember(
          {
            projectId,
            role,
            userId: workspaceInviteeMember.userId,
          },
          tx,
        );

        return this.notificationService.createNotification(
          {
            recipientUserId: workspaceInviteeMember.userId,
            actorUserId: inviterId,
            type: 'PROJECT_MEMBER_ADDED',
            resourceType: 'PROJECT',
            resourceId: projectId,
            dedupeKey: `projectMemberAdded:${projectMember.id}`,
            expiresAt: null,
          },
          tx,
        );
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException({
          status: HttpStatus.CONFLICT,
          message: '此使用者已是專案成員',
          code: ApiCode.RequestError,
        });
      }

      throw error;
    }

    // 推播socket
    this.socketService.emitNotificationCreated(
      workspaceInviteeMember.userId,
      this.notificationService.toPublicNotification(newNotification),
    );
  }

  /** 創建專案 */
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

  /** 取得單一專案的所有成員 */
  async getSingleProjectMember(
    userId: string,
    projectId: string,
  ): Promise<ProjectMemberDto[]> {
    const membership = await this.findMembership(userId, projectId);

    if (!membership || membership.projectArchivedAt) {
      throw new NotFoundException('找不到專案或你沒有存取權限');
    }

    const result =
      await this.projectRepository.getSingleProjectMember(projectId);
    return result.map(({ id, role, user }) => {
      return {
        memberId: id,
        role: role,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      };
    });
  }

  /** 取得新增專案成員通知詳細資訊 */
  async getProjectMemberAddedNotificationDetail(
    notificationId: string,
    recipientUserId: string,
  ): Promise<ProjectMemberAddedNotificationDetail> {
    const notification =
      await this.notificationService.getNotificationDetailByIdForRecipient(
        notificationId,
        recipientUserId,
      );

    const projectId = notification?.resourceId;

    if (
      !notification ||
      notification.type !== 'PROJECT_MEMBER_ADDED' ||
      notification.resourceType !== 'PROJECT' ||
      !projectId
    ) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到此專案成員通知',
        code: ApiCode.ResourceNotFound,
      });
    }

    const projectMember =
      await this.projectRepository.getProjectMemberAddedNotificationDetail(
        projectId,
        recipientUserId,
      );

    if (
      !projectMember ||
      projectMember.project.archivedAt !== null ||
      projectMember.project.workspace.archivedAt !== null
    ) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到此專案成員通知',
        code: ApiCode.ResourceNotFound,
      });
    }

    return {
      role: projectMember.role,
      projectName: projectMember.project.name,
      projectId: projectMember.project.id,
      workspaceName: projectMember.project.workspace.name,
      workspaceId: projectMember.project.workspace.id,
      inviterName: notification.actorUserDisplayName,
      joinedAt: projectMember.joinedAt.toISOString(),
    };
  }

  /** 切換置頂狀態 */
  async switchPinnedStatus(projectId: string, userId: string, pinned: boolean) {
    const projectMembership = await this.findMembership(userId, projectId);

    if (
      !projectMembership ||
      projectMembership.projectArchivedAt !== null ||
      projectMembership.workspaceArchivedAt !== null
    ) {
      throw new AppException({
        status: HttpStatus.FORBIDDEN,
        message: '你沒有管理此專案成員的權限',
        code: ApiCode.RequestError,
      });
    }
    const pinnedAt: Date | null = pinned ? DateTime.utc().toJSDate() : null;
    const result = await this.projectRepository.switchPinnedStatus(
      projectId,
      userId,
      pinnedAt,
    );
    if (result === 0) {
      throw new AppException({
        status: HttpStatus.BAD_REQUEST,
        message: '更新失敗請重試',
        code: ApiCode.RequestError,
      });
    }
  }
}
