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

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly workspaceRepository: WorkspacesRepository,
    private readonly userService: UserService,
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

    const invitee = await this.userService.getByEmail(inviteeEmail);
    if (!invitee) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '此帳號不存在',
        code: ApiCode.RequestError,
      });
    }

    if (invitee.id === inviterUserId) {
      throw new AppException({
        status: HttpStatus.BAD_REQUEST,
        message: '無法邀請自己',
        code: ApiCode.RequestError,
      });
    }
  }
}
