import { HttpStatus, Injectable } from '@nestjs/common';
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

@Injectable()
export class ProjectService {
  constructor(
    private readonly workspaceService: WorkspacesService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
    private readonly prismaService: PrismaService,
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
    };
  }

  /** 新增專案成員 */
  async addProjectMember(
    addProjectMemberDto: AddProjectMemberDto,
    inviterId: string,
  ) {
    const { projectId, memberEmail, role } = addProjectMemberDto;
    const inviter = await this.findMembership(inviterId, projectId);
    if (inviter === null || inviter.projectArchivedAt) {
      throw new AppException({
        status: HttpStatus.FORBIDDEN,
        message: '你沒有邀請此工作區成員的權限',
        code: ApiCode.RequestError,
      });
    }
    // 只允許邀請已註冊使用者
    const invitee = await this.userService.getByEmail(memberEmail);
    if (!invitee) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '此帳號不存在',
        code: ApiCode.ResourceNotFound,
      });
    }

    const isMemberExist = await this.findMembership(invitee.id, projectId);
    if (isMemberExist) {
      throw new AppException({
        status: HttpStatus.CONFLICT,
        message: '此使用者已是專案成員',
        code: ApiCode.RequestError,
      });
    }

    await this.prismaService.$transaction(async (tx) => {
      const projectMember = await this.projectRepository.addProjectMember(
        {
          projectId,
          role,
          userId: invitee.id,
        },
        tx,
      );
      await this.notificationService.createNotification(
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
}
