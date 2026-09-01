import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkspacesRepository } from './workspaces.repository';
import type {
  WorkspaceDto,
  WorkspaceListItemDto,
  WorkspaceMemberDto,
} from '@kanban/contracts/workspaces';

@Injectable()
export class WorkspacesService {
  constructor(private readonly workspaceRepository: WorkspacesRepository) {}

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
}
