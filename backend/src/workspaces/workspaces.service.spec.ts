import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesRepository } from './workspaces.repository';
import { NotFoundException } from '@nestjs/common';
import { WorkspaceRole, type WorkspaceMember } from '@/generated/prisma/client';
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
            getById: jest.fn(),
            getByUserId: jest.fn(),
            create: jest.fn(),
            joinMember: jest.fn(),
            getSingleWorkspaceMember: jest.fn(),
            findMembership: jest.fn(),
          },
        },
      ],
    }).compile();

    workspacesService = module.get(WorkspacesService);
    workspacesRepository = module.get(WorkspacesRepository);
  });

  /** 取得工作區資訊 by id */
  describe('getById', () => {
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
    it('成功取回資料', async () => {
      const getByIdSpy = jest
        .spyOn(workspacesRepository, 'getById')
        .mockResolvedValue(workspace);
      const result = await workspacesService.getById(workspaceId);
      expect(result).toEqual(workspace);
      expect(getByIdSpy).toHaveBeenCalledTimes(1);
      expect(getByIdSpy).toHaveBeenCalledWith(workspaceId);
    });
    it('找不到資料', async () => {
      const getByIdSpy = jest
        .spyOn(workspacesRepository, 'getById')
        .mockResolvedValue(null);
      const result = await workspacesService.getById(workspaceId);
      expect(result).toBeNull();
      expect(getByIdSpy).toHaveBeenCalledTimes(1);
      expect(getByIdSpy).toHaveBeenCalledWith(workspaceId);
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

  /** 加入成員 */
  describe('joinMember', () => {
    const workspaceId = 'testWorkspaceId';
    const userId = 'testUserId';
    const time = new Date('2026-08-26T12:00:00.000Z');
    const workspaceMember = {
      role: 'MEMBER',
      id: '1',
      workspaceId: workspaceId,
      userId: userId,
      joinedAt: time,
    } as WorkspaceMember;
    it('成功加入', async () => {
      const joinMemberSpy = jest
        .spyOn(workspacesRepository, 'joinMember')
        .mockResolvedValue(workspaceMember);
      const result = await workspacesService.joinMember(userId, workspaceId);
      expect(result).toEqual(workspaceMember);
      expect(joinMemberSpy).toHaveBeenCalledTimes(1);
      expect(joinMemberSpy).toHaveBeenCalledWith(
        userId,
        workspaceId,
        undefined,
      );
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
          role: 'MEMBER',
          workspace: {
            archivedAt: null,
            name: '',
          },
          user: {
            displayName: '',
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

  /** 找尋成員 */
  describe('findMembership', () => {
    it('成功找尋', async () => {
      const workspaceName = '測試工作區';
      const memberId = '1';
      const displayName = '測試使用者';
      const role = 'MEMBER' as WorkspaceRole;
      const findMembershipResponse = {
        role,
        workspace: {
          name: workspaceName,
          archivedAt: null,
        },
        id: memberId,
        user: {
          displayName,
        },
      };
      const findMembershipSpy = jest
        .spyOn(workspacesRepository, 'findMembership')
        .mockResolvedValue(findMembershipResponse);
      const result = await workspacesService.findMembership('1', '1');
      expect(result).toEqual({
        memberId,
        memberName: displayName,
        role,
        workspaceName,
        workspaceArchivedAt: null,
      });
      expect(findMembershipSpy).toHaveBeenCalledTimes(1);
      expect(findMembershipSpy).toHaveBeenCalledWith('1', '1');
    });
    it('找尋失敗', async () => {
      const findMembershipSpy = jest
        .spyOn(workspacesRepository, 'findMembership')
        .mockResolvedValue(null);
      const result = await workspacesService.findMembership('1', '1');
      expect(result).toBeNull();
      expect(findMembershipSpy).toHaveBeenCalledTimes(1);
      expect(findMembershipSpy).toHaveBeenCalledWith('1', '1');
    });
  });
});
