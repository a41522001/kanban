import { Test, type TestingModule } from '@nestjs/testing';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import type { Request } from 'express';
import { SessionGuard } from '@/session/session.guard';
import type {
  WorkspaceListItemDto,
  WorkspaceMemberDto,
  WorkspaceRole,
} from '@kanban/contracts/workspaces';
describe('WorkspaceController', () => {
  let controller: WorkspacesController;
  let workspacesService: WorkspacesService;
  const createRequest = (userId?: string): Request => {
    return { userId } as Request;
  };
  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        {
          provide: WorkspacesService,
          useValue: {
            create: jest.fn(),
            getByUserId: jest.fn(),
            getSingleWorkspaceMember: jest.fn(),
          },
        },
      ],
    });

    const module: TestingModule = await moduleBuilder
      .overrideGuard(SessionGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = module.get(WorkspacesController);
    workspacesService = module.get(WorkspacesService);
  });

  /** 創建工作區 */
  describe('create', () => {
    it('創建成功', async () => {
      const userId = 'testId';
      const request = createRequest(userId);
      const workspaceName = '測試工作區';
      const time = new Date('2026-08-26T12:00:00.000Z');
      const createDto = {
        name: workspaceName,
      };
      const workspace = {
        name: workspaceName,
        id: '1',
        createdAt: time.toISOString(),
        updatedAt: time.toISOString(),
      };
      const createSpy = jest
        .spyOn(workspacesService, 'create')
        .mockResolvedValue(workspace);
      const result = await controller.create(request, createDto);
      expect(result).toEqual({
        data: workspace,
      });
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith(userId, workspaceName);
    });
  });

  /** 取得目前使用者加入的工作區 */
  describe('getListMyWorkspaces', () => {
    it('有data的情況', async () => {
      const userId = 'testId';
      const request = createRequest(userId);
      const time = new Date('2026-08-26T12:00:00.000Z');
      const workspace1 = {
        currentUserRole: 'OWNER' as WorkspaceRole,
        id: '1',
        name: '測試工作區1',
        createdAt: time.toISOString(),
        updatedAt: time.toISOString(),
      };
      const workspace2 = {
        currentUserRole: 'MEMBER' as WorkspaceRole,
        id: '2',
        name: '測試工作區2',
        createdAt: time.toISOString(),
        updatedAt: time.toISOString(),
      };
      const workspaceListItemDto: WorkspaceListItemDto[] = [
        workspace1,
        workspace2,
      ];
      const getByUserIdSpy = jest
        .spyOn(workspacesService, 'getByUserId')
        .mockResolvedValue(workspaceListItemDto);
      const result = await controller.getListMyWorkspaces(request);
      expect(result).toEqual({ data: workspaceListItemDto });
      expect(getByUserIdSpy).toHaveBeenCalledTimes(1);
      expect(getByUserIdSpy).toHaveBeenCalledWith(userId);
    });

    it('沒有data的情況', async () => {
      const userId = 'testId';
      const request = createRequest(userId);
      const getByUserIdSpy = jest
        .spyOn(workspacesService, 'getByUserId')
        .mockResolvedValue([]);
      const result = await controller.getListMyWorkspaces(request);
      expect(result).toEqual({ data: [] });
      expect(getByUserIdSpy).toHaveBeenCalledTimes(1);
      expect(getByUserIdSpy).toHaveBeenCalledWith(userId);
    });
  });

  /** 取得單一工作區的所有成員 */
  describe('getListWorkspaceMembers', () => {
    it('有data的情況', async () => {
      const workspaceId = '1';
      const member1 = {
        memberId: '1',
        displayName: '測試成員1',
        avatarUrl: null,
        role: 'OWNER' as WorkspaceRole,
      };
      const member2 = {
        memberId: '2',
        displayName: '測試成員2',
        avatarUrl: null,
        role: 'MEMBER' as WorkspaceRole,
      };
      const workspaceMemberDto: WorkspaceMemberDto[] = [member1, member2];
      const getSingleWorkspaceMemberSpy = jest
        .spyOn(workspacesService, 'getSingleWorkspaceMember')
        .mockResolvedValue(workspaceMemberDto);
      const result = await controller.getListWorkspaceMembers(workspaceId);
      const ownerLength = result.data!.filter((item) => item.role === 'OWNER');
      expect(ownerLength).toHaveLength(1);
      expect(result).toEqual({ data: workspaceMemberDto });
      expect(getSingleWorkspaceMemberSpy).toHaveBeenCalledTimes(1);
      expect(getSingleWorkspaceMemberSpy).toHaveBeenCalledWith(workspaceId);
    });

    it('沒有data的情況', async () => {
      const workspaceId = '1';
      const getSingleWorkspaceMemberSpy = jest
        .spyOn(workspacesService, 'getSingleWorkspaceMember')
        .mockResolvedValue([]);
      const result = await controller.getListWorkspaceMembers(workspaceId);
      expect(result).toEqual({ data: [] });
      expect(getSingleWorkspaceMemberSpy).toHaveBeenCalledTimes(1);
      expect(getSingleWorkspaceMemberSpy).toHaveBeenCalledWith(workspaceId);
    });
  });
});
