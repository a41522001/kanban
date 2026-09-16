import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRepository } from './project.repository';
import { CreateProjectDto } from './dto/createProject.dto';
import { WorkspacesService } from '@/workspaces/workspaces.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import { PrismaService } from '@/prisma/prisma.service';
import { AddProjectMemberDto } from './dto/addProjectMember.dto';
import { UserService } from '@/user/user.service';
import { FindMembershipResponse } from './project.type';
import { NotificationService } from '@/notification/notification.service';
import { SocketService } from '@/socket/socket.service';
import { Prisma, type Notification } from '@/generated/prisma/client';
import type { ProjectMemberDto } from '@kanban/contracts/project';
@Injectable()
export class ProjectService {
  constructor(
    private readonly workspaceService: WorkspacesService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
    private readonly prismaService: PrismaService,
    private readonly socketService: SocketService,
    private readonly projectRepository: ProjectRepository,
  ) {}
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
      workspaceId: result.project.workspaceId,
    };
  }

  /** 新增專案成員 */
  async addProjectMember(
    addProjectMemberDto: AddProjectMemberDto,
    inviterId: string,
  ) {
    const { projectId, memberEmail, role } = addProjectMemberDto;
    const [inviter, invitee] = await Promise.all([
      this.findMembership(inviterId, projectId),
      this.userService.getByEmail(memberEmail),
    ]);
    if (
      inviter === null ||
      inviter.projectArchivedAt !== null ||
      inviter.role !== 'OWNER'
    ) {
      throw new AppException({
        status: HttpStatus.FORBIDDEN,
        message: '你沒有邀請此專案成員的權限',
        code: ApiCode.RequestError,
      });
    }
    // 只允許邀請已註冊使用者
    if (!invitee) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '此帳號不存在',
        code: ApiCode.ResourceNotFound,
      });
    }
    // 判斷邀請人與被邀請人是否存在於正確的工作區
    const [workspaceInviterMember, workspaceInviteeMember] = await Promise.all([
      this.workspaceService.findMembership(inviterId, inviter.workspaceId),
      this.workspaceService.findMembership(invitee.id, inviter.workspaceId),
    ]);
    if (
      !workspaceInviterMember ||
      !workspaceInviteeMember ||
      workspaceInviterMember.workspaceArchivedAt !== null ||
      workspaceInviteeMember.workspaceArchivedAt !== null
    ) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '此工作區不存在',
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
            userId: invitee.id,
          },
          tx,
        );

        return this.notificationService.createNotification(
          {
            recipientUserId: invitee.id,
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
      invitee.id,
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
}
