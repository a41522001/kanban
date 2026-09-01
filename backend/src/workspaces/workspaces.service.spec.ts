import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesRepository } from './workspaces.repository';
import { NotFoundException } from '@nestjs/common';

describe('WorkspacesService', () => {
  let workspacesService: WorkspacesService;
  let workspacesRepository: WorkspacesRepository;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        {
          provide: WorkspacesRepository,
          useValue: {
            create: jest.fn(),
            getByUserId: jest.fn(),
            getSingleWorkspaceMember: jest.fn(),
            findMembership: jest.fn(),
          },
        },
      ],
    }).compile();

    workspacesService = module.get(WorkspacesService);
    workspacesRepository = module.get(WorkspacesRepository);
  });

  /** 創建工作區 */
  describe('create', () => {
    it('創建成功', async () => {
      const userId = 'user1';
      const workspaceId = '1';
      const workspaceName = '測試工作區';
      const time = new Date('2026-08-26T12:00:00.000Z');
      const workspace = {
        id: workspaceId,
        name: workspaceName,
        createdAt: time,
        updatedAt: time,
        createdById: userId,
        archivedAt: null,
      };
      const createSpy = jest
        .spyOn(workspacesRepository, 'create')
        .mockResolvedValue(workspace);
      const result = await workspacesService.create(userId, workspaceName);
      expect(result).toEqual({
        id: workspaceId,
        name: workspaceName,
        createdAt: time.toISOString(),
        updatedAt: time.toISOString(),
      });
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith(userId, workspaceName);
    });
  });

  /** 取得使用者加入的工作區 */
  describe('getByUserId', () => {
    type Membership = Awaited<
      ReturnType<WorkspacesRepository['getByUserId']>
    >[number];
    const time = new Date('2026-08-26T12:00:00.000Z');
    const workspace1 = {
      id: '1',
      name: '測試工作區1',
      createdAt: time,
      updatedAt: time,
    };
    const workspace2 = {
      id: '2',
      name: '測試工作區2',
      createdAt: time,
      updatedAt: time,
    };
    const memberships: Membership[] = [
      {
        workspace: workspace1,
        role: 'OWNER',
      },
      {
        workspace: workspace2,
        role: 'MEMBER',
      },
    ];
    const userId = '1';
    it('有data的情況', async () => {
      const expectResult = [
        {
          id: '1',
          name: '測試工作區1',
          createdAt: time.toISOString(),
          updatedAt: time.toISOString(),
          currentUserRole: 'OWNER',
        },
        {
          id: '2',
          name: '測試工作區2',
          createdAt: time.toISOString(),
          updatedAt: time.toISOString(),
          currentUserRole: 'MEMBER',
        },
      ];
      const getByUserIdSpy = jest
        .spyOn(workspacesRepository, 'getByUserId')
        .mockResolvedValue(memberships);

      const result = await workspacesService.getByUserId(userId);
      expect(result).toEqual(expectResult);
      expect(getByUserIdSpy).toHaveBeenCalledTimes(1);
      expect(getByUserIdSpy).toHaveBeenCalledWith(userId);
    });

    it('沒有data的情況', async () => {
      const getByUserIdSpy = jest
        .spyOn(workspacesRepository, 'getByUserId')
        .mockResolvedValue([]);
      const result = await workspacesService.getByUserId(userId);
      expect(result).toEqual([]);
      expect(getByUserIdSpy).toHaveBeenCalledTimes(1);
      expect(getByUserIdSpy).toHaveBeenCalledWith(userId);
    });
  });

  /** 取得單一工作區的所有成員 */
  describe('getSingleWorkspaceMember', () => {
    type WorkspaceMemberResponse = Awaited<
      ReturnType<WorkspacesRepository['getSingleWorkspaceMember']>
    >[number];
    const userId = '1';
    const workspaceId = 'testworkspaceId';
    const member1 = {
      id: '1',
      displayName: 'test1',
      avatarUrl: null,
    };
    const member2 = {
      id: '2',
      displayName: 'test2',
      avatarUrl: null,
    };
    const workspaceMemberResponse: WorkspaceMemberResponse[] = [
      {
        role: 'OWNER',
        id: member1.id,
        user: {
          displayName: member1.displayName,
          avatarUrl: member1.avatarUrl,
        },
      },
      {
        role: 'MEMBER',
        id: member2.id,
        user: {
          displayName: member2.displayName,
          avatarUrl: member2.avatarUrl,
        },
      },
    ];

    it('有data的情況', async () => {
      const expectResult = [
        {
          memberId: '1',
          role: 'OWNER',
          displayName: 'test1',
          avatarUrl: null,
        },
        {
          memberId: '2',
          role: 'MEMBER',
          displayName: 'test2',
          avatarUrl: null,
        },
      ];
      const getSingleWorkspaceMemberSpy = jest
        .spyOn(workspacesRepository, 'getSingleWorkspaceMember')
        .mockResolvedValue(workspaceMemberResponse);
      const findMembershipSpy = jest
        .spyOn(workspacesRepository, 'findMembership')
        .mockResolvedValue({
          id: 'membership-1',
          workspace: {
            archivedAt: null,
          },
        });
      const result = await workspacesService.getSingleWorkspaceMember(
        userId,
        workspaceId,
      );
      expect(result).toEqual(expectResult);
      expect(getSingleWorkspaceMemberSpy).toHaveBeenCalledTimes(1);
      expect(getSingleWorkspaceMemberSpy).toHaveBeenCalledWith(workspaceId);
      expect(findMembershipSpy).toHaveBeenCalledTimes(1);
      expect(findMembershipSpy).toHaveBeenCalledWith(userId, workspaceId);
    });

    it('沒有data的情況', async () => {
      const getSingleWorkspaceMemberSpy = jest
        .spyOn(workspacesRepository, 'getSingleWorkspaceMember')
        .mockResolvedValue([]);
      const findMembershipSpy = jest
        .spyOn(workspacesRepository, 'findMembership')
        .mockResolvedValue(null);

      await expect(
        workspacesService.getSingleWorkspaceMember(userId, workspaceId),
      ).rejects.toThrow(NotFoundException);

      expect(findMembershipSpy).toHaveBeenCalledTimes(1);
      expect(findMembershipSpy).toHaveBeenCalledWith(userId, workspaceId);
      expect(getSingleWorkspaceMemberSpy).toHaveBeenCalledTimes(0);
    });
  });
});
