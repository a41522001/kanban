import { HttpStatus, NotFoundException } from '@nestjs/common';
import { WorkspacesService } from '@/workspaces/workspaces.service';
import { ProjectRepository } from './project.repository';
import { ProjectService } from './project.service';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '@/notification/notification.service';
import { PrismaService } from '@/prisma/prisma.service';
import { SocketService } from '@/socket/socket.service';
import { Prisma } from '@/generated/prisma/client';
import type { ProjectListItemRecord } from './project.type';
import { ApiCode } from '@kanban/contracts/api';
describe('ProjectService', () => {
  let projectService: ProjectService;
  let projectRepository: ProjectRepository;
  let workspacesService: WorkspacesService;
  let notificationService: NotificationService;
  let prismaService: PrismaService;
  let socketService: SocketService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: ProjectRepository,
          useValue: {
            getProjectsByWorkspaceIdAndUserId: jest.fn(),
            findMembership: jest.fn(),
            getMemberCandidates: jest.fn(),
            addProjectMember: jest.fn(),
            createProject: jest.fn(),
            getSingleProjectMember: jest.fn(),
            getProjectMemberAddedNotificationDetail: jest.fn(),
            switchPinnedStatus: jest.fn(),
          },
        },
        {
          provide: WorkspacesService,
          useValue: {
            findMembership: jest.fn(),
            findMembershipById: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            createNotification: jest.fn(),
            toPublicNotification: jest.fn(),
            getNotificationDetailByIdForRecipient: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
          },
        },
        {
          provide: SocketService,
          useValue: {
            emitNotificationCreated: jest.fn(),
          },
        },
      ],
    }).compile();

    projectService = module.get(ProjectService);
    projectRepository = module.get(ProjectRepository);
    workspacesService = module.get(WorkspacesService);
    notificationService = module.get(NotificationService);
    prismaService = module.get(PrismaService);
    socketService = module.get(SocketService);
  });

  it('defined', () => {
    expect(projectService).toBeDefined();
    expect(projectRepository).toBeDefined();
    expect(workspacesService).toBeDefined();
    expect(notificationService).toBeDefined();
    expect(prismaService).toBeDefined();
    expect(socketService).toBeDefined();
  });
  /** 取得使用者在指定工作區所屬的專案 */
  describe('getProjectsByWorkspaceIdAndUserId', () => {
    const workspaceId = 'workspace-1';
    const userId = 'user-1';

    it('成功取得專案列表並格式化時間為 ISO 字串', async () => {
      jest.spyOn(workspacesService, 'findMembership').mockResolvedValue({
        memberId: 'workspace-member-1',
        memberName: 'User 1',
        role: 'MEMBER',
        workspaceName: 'Flowboard Workspace',
        workspaceArchivedAt: null,
      });

      const now = new Date();
      const mockRawProjects: ProjectListItemRecord[] = [
        {
          id: 'project-1',
          workspaceId,
          name: 'Project Alpha',
          description: 'Description 1',
          status: 'ACTIVE' as const,
          createdAt: now,
          updatedAt: now,
          pinnedAt: null,
          createdById: '1',
          archivedAt: null,
        },
        {
          id: 'project-2',
          workspaceId,
          name: 'Project Beta',
          description: null,
          status: 'COMPLETED' as const,
          createdAt: now,
          updatedAt: now,
          pinnedAt: null,
          createdById: '2',
          archivedAt: null,
        },
      ];

      const getProjectsSpy = jest
        .spyOn(projectRepository, 'getProjectsByWorkspaceIdAndUserId')
        .mockResolvedValue(mockRawProjects);

      const result = await projectService.getProjectsByWorkspaceIdAndUserId(
        workspaceId,
        userId,
      );

      expect(getProjectsSpy).toHaveBeenCalledWith(workspaceId, userId);
      expect(result).toEqual([
        {
          id: 'project-1',
          workspaceId,
          name: 'Project Alpha',
          description: 'Description 1',
          status: 'ACTIVE',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          pinnedAt: null,
        },
        {
          id: 'project-2',
          workspaceId,
          name: 'Project Beta',
          description: null,
          status: 'COMPLETED',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          pinnedAt: null,
        },
      ]);
    });

    it('找不到工作區或使用者不是成員時拋出 NOT_FOUND', async () => {
      jest.spyOn(workspacesService, 'findMembership').mockResolvedValue(null);

      const getProjectsSpy = jest.spyOn(
        projectRepository,
        'getProjectsByWorkspaceIdAndUserId',
      );

      await expect(
        projectService.getProjectsByWorkspaceIdAndUserId(workspaceId, userId),
      ).rejects.toMatchObject({ message: '找不到此工作區' });

      expect(getProjectsSpy).not.toHaveBeenCalled();
    });

    it('工作區已被封存時拋出 BAD_REQUEST', async () => {
      jest.spyOn(workspacesService, 'findMembership').mockResolvedValue({
        memberId: 'workspace-member-1',
        memberName: 'User 1',
        role: 'MEMBER',
        workspaceName: 'Flowboard Workspace',
        workspaceArchivedAt: new Date(),
      });

      const getProjectsSpy = jest.spyOn(
        projectRepository,
        'getProjectsByWorkspaceIdAndUserId',
      );

      await expect(
        projectService.getProjectsByWorkspaceIdAndUserId(workspaceId, userId),
      ).rejects.toMatchObject({ message: '此工作區已被封存' });

      expect(getProjectsSpy).not.toHaveBeenCalled();
    });
  });

  /** 取得Workspace的候選清單 */
  describe('getMemberCandidates', () => {
    const ownerMembership = {
      id: 'project-member-owner',
      role: 'OWNER' as const,
      project: {
        name: 'Flowboard',
        archivedAt: null,
        workspaceId: 'workspace-1',
        workspace: { archivedAt: null },
      },
      user: { displayName: 'Owner' },
    };

    const candidate = {
      workspaceMemberId: 'workspace-member-2',
      displayName: 'Mina',
      avatarUrl: null,
      projectRole: null,
    };

    it('Project OWNER 可取得同 Workspace 的候選清單', async () => {
      jest
        .spyOn(projectRepository, 'findMembership')
        .mockResolvedValue(ownerMembership);
      jest.spyOn(workspacesService, 'findMembership').mockResolvedValue({
        memberId: 'workspace-member-1',
        memberName: 'Owner',
        role: 'OWNER',
        workspaceName: 'Flowboard Workspace',
        workspaceArchivedAt: null,
      });
      const getMemberCandidatesSpy = jest
        .spyOn(projectRepository, 'getMemberCandidates')
        .mockResolvedValue([candidate]);

      await expect(
        projectService.getMemberCandidates('owner-user', 'project-1'),
      ).resolves.toEqual([candidate]);
      expect(getMemberCandidatesSpy).toHaveBeenCalledWith('project-1');
    });

    it('Workspace 已封存時不可取得候選清單', async () => {
      jest.spyOn(projectRepository, 'findMembership').mockResolvedValue({
        ...ownerMembership,
        project: {
          ...ownerMembership.project,
          workspace: { archivedAt: new Date() },
        },
      });
      const getMemberCandidatesSpy = jest.spyOn(
        projectRepository,
        'getMemberCandidates',
      );

      await expect(
        projectService.getMemberCandidates('owner-user', 'project-1'),
      ).rejects.toMatchObject({ message: '你沒有管理此專案成員的權限' });
      expect(getMemberCandidatesSpy).not.toHaveBeenCalled();
    });
  });

  /** 找尋成員 */
  describe('findMembership', () => {
    const userId = 'user-1';
    const projectId = 'project-1';

    it('成功找到成員時，扁平化組裝並回傳成員資訊', async () => {
      const mockRepoResult = {
        id: 'project-member-1',
        role: 'OWNER' as const,
        project: {
          name: 'Flowboard Project',
          archivedAt: null,
          workspaceId: 'workspace-1',
          workspace: {
            archivedAt: null,
          },
        },
        user: {
          displayName: 'Alex',
        },
      };

      const findMembershipSpy = jest
        .spyOn(projectRepository, 'findMembership')
        .mockResolvedValue(mockRepoResult);

      const result = await projectService.findMembership(userId, projectId);

      expect(findMembershipSpy).toHaveBeenCalledWith(userId, projectId);
      expect(result).toEqual({
        memberId: 'project-member-1',
        memberName: 'Alex',
        role: 'OWNER',
        projectName: 'Flowboard Project',
        projectArchivedAt: null,
        workspaceArchivedAt: null,
        workspaceId: 'workspace-1',
      });
    });

    it('當成員不存在時回傳 null', async () => {
      const findMembershipSpy = jest
        .spyOn(projectRepository, 'findMembership')
        .mockResolvedValue(null);

      const result = await projectService.findMembership(userId, projectId);

      expect(findMembershipSpy).toHaveBeenCalledWith(userId, projectId);
      expect(result).toBeNull();
    });
  });

  /** 新增專案成員 */
  describe('addProjectMember', () => {
    const ownerMembership = {
      id: 'project-member-owner',
      role: 'OWNER' as const,
      project: {
        name: 'Flowboard',
        archivedAt: null,
        workspaceId: 'workspace-1',
        workspace: { archivedAt: null },
      },
      user: { displayName: 'Owner' },
    };

    it('拒絕加入其他 Workspace 的 membership', async () => {
      jest
        .spyOn(projectRepository, 'findMembership')
        .mockResolvedValue(ownerMembership);
      jest.spyOn(workspacesService, 'findMembership').mockResolvedValue({
        memberId: 'workspace-member-1',
        memberName: 'Owner',
        role: 'OWNER',
        workspaceName: 'Flowboard Workspace',
        workspaceArchivedAt: null,
      });
      jest.spyOn(workspacesService, 'findMembershipById').mockResolvedValue({
        memberId: 'workspace-member-2',
        userId: 'user-2',
        workspaceId: 'workspace-2',
        workspaceArchivedAt: null,
      });

      const addProjectMemberSpy = jest.spyOn(
        projectRepository,
        'addProjectMember',
      );
      await expect(
        projectService.addProjectMember(
          {
            projectId: 'project-1',
            workspaceMemberId: 'workspace-member-2',
            role: 'EDITOR',
          },
          'owner-user',
        ),
      ).rejects.toMatchObject({ message: '找不到此工作區成員' });
      expect(addProjectMemberSpy).not.toHaveBeenCalled();
    });

    it('非專案 OWNER 試圖加入成員時拋出 FORBIDDEN', async () => {
      const editorMembership = {
        ...ownerMembership,
        role: 'EDITOR' as const,
      };
      jest
        .spyOn(projectRepository, 'findMembership')
        .mockResolvedValue(editorMembership);

      await expect(
        projectService.addProjectMember(
          {
            projectId: 'project-1',
            workspaceMemberId: 'workspace-member-2',
            role: 'VIEWER',
          },
          'editor-user',
        ),
      ).rejects.toMatchObject({ message: '你沒有邀請此專案成員的權限' });
    });

    it('專案已封存時拋出 FORBIDDEN', async () => {
      const archivedProjectMembership = {
        ...ownerMembership,
        project: {
          ...ownerMembership.project,
          archivedAt: new Date(),
        },
      };
      jest
        .spyOn(projectRepository, 'findMembership')
        .mockResolvedValue(archivedProjectMembership);

      await expect(
        projectService.addProjectMember(
          {
            projectId: 'project-1',
            workspaceMemberId: 'workspace-member-2',
            role: 'EDITOR',
          },
          'owner-user',
        ),
      ).rejects.toMatchObject({ message: '你沒有邀請此專案成員的權限' });
    });

    it('成功將成員加入專案並發送通知與 Socket 推播', async () => {
      jest
        .spyOn(projectRepository, 'findMembership')
        .mockResolvedValue(ownerMembership);

      jest.spyOn(workspacesService, 'findMembership').mockResolvedValue({
        memberId: 'workspace-member-1',
        memberName: 'Owner',
        role: 'OWNER',
        workspaceName: 'Flowboard Workspace',
        workspaceArchivedAt: null,
      });

      jest.spyOn(workspacesService, 'findMembershipById').mockResolvedValue({
        memberId: 'workspace-member-2',
        userId: 'user-2',
        workspaceId: 'workspace-1',
        workspaceArchivedAt: null,
      });

      const tx = {} as Prisma.TransactionClient;
      jest
        .spyOn(prismaService, '$transaction')
        .mockImplementation(async (callback) => {
          return callback(tx);
        });

      const mockProjectMember = {
        id: 'project-member-new',
        projectId: 'project-1',
        userId: 'user-2',
        role: 'EDITOR' as const,
        joinedAt: new Date(),
        pinnedAt: null,
      };
      const addProjectMemberSpy = jest
        .spyOn(projectRepository, 'addProjectMember')
        .mockResolvedValue(mockProjectMember);

      const mockNotification = {
        id: 'notification-1',
        recipientUserId: 'user-2',
        actorUserId: 'owner-user',
        type: 'PROJECT_MEMBER_ADDED' as const,
        resourceType: 'PROJECT' as const,
        resourceId: 'project-1',
        dedupeKey: 'projectMemberAdded:project-member-new',
        readAt: null,
        expiresAt: null,
        createdAt: new Date(),
      };
      const createNotificationSpy = jest
        .spyOn(notificationService, 'createNotification')
        .mockResolvedValue(mockNotification);

      const mockPublicNotification = {
        id: 'notification-1',
        type: 'PROJECT_MEMBER_ADDED' as const,
        resourceType: 'PROJECT' as const,
        resourceId: 'project-1',
        readAt: null,
        expiresAt: null,
        createdAt: mockNotification.createdAt.toISOString(),
      };
      jest
        .spyOn(notificationService, 'toPublicNotification')
        .mockReturnValue(mockPublicNotification);

      const emitNotificationCreatedSpy = jest.spyOn(
        socketService,
        'emitNotificationCreated',
      );

      await expect(
        projectService.addProjectMember(
          {
            projectId: 'project-1',
            workspaceMemberId: 'workspace-member-2',
            role: 'EDITOR',
          },
          'owner-user',
        ),
      ).resolves.toBeUndefined();

      expect(addProjectMemberSpy).toHaveBeenCalledWith(
        {
          projectId: 'project-1',
          role: 'EDITOR',
          userId: 'user-2',
        },
        tx,
      );

      expect(createNotificationSpy).toHaveBeenCalledWith(
        {
          recipientUserId: 'user-2',
          actorUserId: 'owner-user',
          type: 'PROJECT_MEMBER_ADDED',
          resourceType: 'PROJECT',
          resourceId: 'project-1',
          dedupeKey: 'projectMemberAdded:project-member-new',
          expiresAt: null,
        },
        tx,
      );

      expect(emitNotificationCreatedSpy).toHaveBeenCalledWith(
        'user-2',
        mockPublicNotification,
      );
    });

    it('若使用者已是專案成員，捕捉 Prisma P2002 並轉換為 CONFLICT', async () => {
      jest
        .spyOn(projectRepository, 'findMembership')
        .mockResolvedValue(ownerMembership);

      jest.spyOn(workspacesService, 'findMembership').mockResolvedValue({
        memberId: 'workspace-member-1',
        memberName: 'Owner',
        role: 'OWNER',
        workspaceName: 'Flowboard Workspace',
        workspaceArchivedAt: null,
      });

      jest.spyOn(workspacesService, 'findMembershipById').mockResolvedValue({
        memberId: 'workspace-member-2',
        userId: 'user-2',
        workspaceId: 'workspace-1',
        workspaceArchivedAt: null,
      });

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '7.9.1',
        },
      );
      jest.spyOn(prismaService, '$transaction').mockRejectedValue(p2002Error);

      const emitNotificationCreatedSpy = jest.spyOn(
        socketService,
        'emitNotificationCreated',
      );

      await expect(
        projectService.addProjectMember(
          {
            projectId: 'project-1',
            workspaceMemberId: 'workspace-member-2',
            role: 'EDITOR',
          },
          'owner-user',
        ),
      ).rejects.toMatchObject({ message: '此使用者已是專案成員' });

      expect(emitNotificationCreatedSpy).not.toHaveBeenCalled();
    });
  });

  /** 創建專案 */
  describe('createProject', () => {
    const createProjectDto = {
      name: 'Flowboard Kanban',
      description: 'A collaborative kanban board',
      workspaceId: 'workspace-1',
    };
    const userId = 'user-owner-1';

    it('成功在 Transaction 內建立專案並將建立者加入為 OWNER', async () => {
      jest.spyOn(workspacesService, 'findMembership').mockResolvedValue({
        memberId: 'workspace-member-1',
        memberName: 'Owner User',
        role: 'OWNER',
        workspaceName: 'Flowboard Workspace',
        workspaceArchivedAt: null,
      });

      const tx = {} as Prisma.TransactionClient;
      jest
        .spyOn(prismaService, '$transaction')
        .mockImplementation(async (callback) => {
          return callback(tx);
        });

      const mockProject = {
        id: 'project-new-1',
        name: createProjectDto.name,
        description: createProjectDto.description,
        workspaceId: createProjectDto.workspaceId,
        status: 'ACTIVE' as const,
        createdById: userId,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const createProjectSpy = jest
        .spyOn(projectRepository, 'createProject')
        .mockResolvedValue(mockProject);

      const addProjectMemberSpy = jest
        .spyOn(projectRepository, 'addProjectMember')
        .mockResolvedValue({
          id: 'project-member-new',
          projectId: 'project-new-1',
          userId,
          role: 'OWNER',
          joinedAt: new Date(),
          pinnedAt: null,
        });

      await expect(
        projectService.createProject(createProjectDto, userId),
      ).resolves.toBeUndefined();

      expect(createProjectSpy).toHaveBeenCalledWith(
        createProjectDto,
        userId,
        tx,
      );
      expect(addProjectMemberSpy).toHaveBeenCalledWith(
        {
          projectId: 'project-new-1',
          role: 'OWNER',
          userId,
        },
        tx,
      );
    });

    it('找不到工作區或使用者不是成員時拋出 NOT_FOUND', async () => {
      jest.spyOn(workspacesService, 'findMembership').mockResolvedValue(null);

      const transactionSpy = jest.spyOn(prismaService, '$transaction');
      const createProjectSpy = jest.spyOn(projectRepository, 'createProject');

      await expect(
        projectService.createProject(createProjectDto, userId),
      ).rejects.toMatchObject({ message: '找不到此工作區' });

      expect(transactionSpy).not.toHaveBeenCalled();
      expect(createProjectSpy).not.toHaveBeenCalled();
    });

    it('工作區已被封存時拋出 BAD_REQUEST', async () => {
      jest.spyOn(workspacesService, 'findMembership').mockResolvedValue({
        memberId: 'workspace-member-1',
        memberName: 'Owner User',
        role: 'OWNER',
        workspaceName: 'Flowboard Workspace',
        workspaceArchivedAt: new Date(),
      });

      const transactionSpy = jest.spyOn(prismaService, '$transaction');
      const createProjectSpy = jest.spyOn(projectRepository, 'createProject');

      await expect(
        projectService.createProject(createProjectDto, userId),
      ).rejects.toMatchObject({ message: '此工作區已被封存' });

      expect(transactionSpy).not.toHaveBeenCalled();
      expect(createProjectSpy).not.toHaveBeenCalled();
    });
  });

  /** 取得單一專案的所有成員 */
  describe('getSingleProjectMember', () => {
    const userId = 'user-1';
    const projectId = 'project-1';

    const ownerMembership = {
      id: 'project-member-1',
      role: 'OWNER' as const,
      project: {
        name: 'Flowboard',
        archivedAt: null,
        workspaceId: 'workspace-1',
        workspace: { archivedAt: null },
      },
      user: { displayName: 'Owner' },
    };

    it('成功取得單一專案所有成員並映射 DTO', async () => {
      jest
        .spyOn(projectRepository, 'findMembership')
        .mockResolvedValue(ownerMembership);

      const mockMembers = [
        {
          id: 'member-1',
          role: 'OWNER' as const,
          user: { displayName: 'Alice', avatarUrl: null },
        },
        {
          id: 'member-2',
          role: 'EDITOR' as const,
          user: {
            displayName: 'Bob',
            avatarUrl: 'https://example.com/avatar.png',
          },
        },
      ];

      const getSingleProjectMemberSpy = jest
        .spyOn(projectRepository, 'getSingleProjectMember')
        .mockResolvedValue(mockMembers);

      const result = await projectService.getSingleProjectMember(
        userId,
        projectId,
      );

      expect(getSingleProjectMemberSpy).toHaveBeenCalledWith(projectId);
      expect(result).toEqual([
        {
          memberId: 'member-1',
          role: 'OWNER',
          displayName: 'Alice',
          avatarUrl: null,
        },
        {
          memberId: 'member-2',
          role: 'EDITOR',
          displayName: 'Bob',
          avatarUrl: 'https://example.com/avatar.png',
        },
      ]);
    });

    it('使用者非專案成員時拋出 NotFoundException', async () => {
      jest.spyOn(projectRepository, 'findMembership').mockResolvedValue(null);

      const getSingleProjectMemberSpy = jest.spyOn(
        projectRepository,
        'getSingleProjectMember',
      );

      await expect(
        projectService.getSingleProjectMember(userId, projectId),
      ).rejects.toThrow(NotFoundException);

      expect(getSingleProjectMemberSpy).not.toHaveBeenCalled();
    });

    it('專案已被封存時拋出 NotFoundException', async () => {
      jest.spyOn(projectRepository, 'findMembership').mockResolvedValue({
        ...ownerMembership,
        project: {
          ...ownerMembership.project,
          archivedAt: new Date(),
        },
      });

      const getSingleProjectMemberSpy = jest.spyOn(
        projectRepository,
        'getSingleProjectMember',
      );

      await expect(
        projectService.getSingleProjectMember(userId, projectId),
      ).rejects.toThrow(NotFoundException);

      expect(getSingleProjectMemberSpy).not.toHaveBeenCalled();
    });
  });

  /** 取得新增專案成員通知詳細資訊 */
  describe('getProjectMemberAddedNotificationDetail', () => {
    const notificationId = 'notification-1';
    const recipientUserId = 'user-recipient-1';
    const projectId = 'project-1';

    it('成功取得加入專案通知詳細資訊並格式化時間', async () => {
      const mockNotification = {
        id: notificationId,
        type: 'PROJECT_MEMBER_ADDED' as const,
        resourceType: 'PROJECT' as const,
        resourceId: projectId,
        createdAt: new Date(),
        actorUserDisplayName: 'Inviter User',
        actorUserAvatarUrl: 'https://example.com/inviter.png',
      };

      jest
        .spyOn(notificationService, 'getNotificationDetailByIdForRecipient')
        .mockResolvedValue(mockNotification);

      const joinedAtDate = new Date('2026-09-20T12:00:00.000Z');
      const mockProjectMember = {
        id: 'project-member-1',
        role: 'EDITOR' as const,
        joinedAt: joinedAtDate,
        project: {
          id: projectId,
          name: 'Flowboard Kanban',
          archivedAt: null,
          workspace: {
            id: 'workspace-1',
            name: 'Flowboard Workspace',
            archivedAt: null,
          },
        },
      };

      const getDetailSpy = jest
        .spyOn(projectRepository, 'getProjectMemberAddedNotificationDetail')
        .mockResolvedValue(mockProjectMember as never);

      const result =
        await projectService.getProjectMemberAddedNotificationDetail(
          notificationId,
          recipientUserId,
        );

      expect(getDetailSpy).toHaveBeenCalledWith(projectId, recipientUserId);
      expect(result).toEqual({
        role: 'EDITOR',
        projectName: 'Flowboard Kanban',
        projectId,
        workspaceName: 'Flowboard Workspace',
        workspaceId: 'workspace-1',
        inviterName: 'Inviter User',
        joinedAt: joinedAtDate.toISOString(),
      });
    });

    it('通知不存在、類型不符或 resourceId 為空時拋出 404', async () => {
      jest
        .spyOn(notificationService, 'getNotificationDetailByIdForRecipient')
        .mockResolvedValue(null);

      const getDetailSpy = jest.spyOn(
        projectRepository,
        'getProjectMemberAddedNotificationDetail',
      );

      await expect(
        projectService.getProjectMemberAddedNotificationDetail(
          notificationId,
          recipientUserId,
        ),
      ).rejects.toMatchObject({ message: '找不到此專案成員通知' });

      expect(getDetailSpy).not.toHaveBeenCalled();
    });

    it('專案或工作區已被封存時拋出 404', async () => {
      const mockNotification = {
        id: notificationId,
        type: 'PROJECT_MEMBER_ADDED' as const,
        resourceType: 'PROJECT' as const,
        resourceId: projectId,
        createdAt: new Date(),
        actorUserDisplayName: 'Inviter User',
        actorUserAvatarUrl: null,
      };

      jest
        .spyOn(notificationService, 'getNotificationDetailByIdForRecipient')
        .mockResolvedValue(mockNotification);

      const mockArchivedProjectMember = {
        id: 'project-member-1',
        role: 'EDITOR' as const,
        joinedAt: new Date(),
        project: {
          id: projectId,
          name: 'Flowboard Kanban',
          archivedAt: new Date(),
          workspace: {
            id: 'workspace-1',
            name: 'Flowboard Workspace',
            archivedAt: null,
          },
        },
      };

      jest
        .spyOn(projectRepository, 'getProjectMemberAddedNotificationDetail')
        .mockResolvedValue(mockArchivedProjectMember as never);

      await expect(
        projectService.getProjectMemberAddedNotificationDetail(
          notificationId,
          recipientUserId,
        ),
      ).rejects.toMatchObject({ message: '找不到此專案成員通知' });
    });
  });

  /** 切換專案置頂狀態 */
  describe('switchPinnedStatus', () => {
    const projectId = 'project-1';
    const userId = 'user-1';
    const activeMembership = {
      id: 'project-member-1',
      role: 'EDITOR' as const,
      project: {
        name: 'Flowboard Kanban',
        archivedAt: null,
        workspaceId: 'workspace-1',
        workspace: { archivedAt: null },
      },
      user: { displayName: 'User 1' },
    };

    afterEach(() => {
      jest.useRealTimers();
    });

    it('置頂有效專案時以目前 UTC 時間更新成員的 pinnedAt', async () => {
      // Arrange
      const now = new Date('2026-09-21T08:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(now);
      jest
        .spyOn(projectRepository, 'findMembership')
        .mockResolvedValue(activeMembership);
      const switchPinnedStatusSpy = jest
        .spyOn(projectRepository, 'switchPinnedStatus')
        .mockResolvedValue(1);

      // Act
      await projectService.switchPinnedStatus(projectId, userId, true);

      // Assert
      expect(switchPinnedStatusSpy).toHaveBeenCalledWith(
        projectId,
        userId,
        now,
      );
    });

    it('取消置頂有效專案時以 null 更新成員的 pinnedAt', async () => {
      // Arrange
      jest
        .spyOn(projectRepository, 'findMembership')
        .mockResolvedValue(activeMembership);
      const switchPinnedStatusSpy = jest
        .spyOn(projectRepository, 'switchPinnedStatus')
        .mockResolvedValue(1);

      // Act
      await projectService.switchPinnedStatus(projectId, userId, false);

      // Assert
      expect(switchPinnedStatusSpy).toHaveBeenCalledWith(
        projectId,
        userId,
        null,
      );
    });

    it('使用者不是專案成員時拋出 FORBIDDEN 且不更新置頂狀態', async () => {
      // Arrange
      jest.spyOn(projectRepository, 'findMembership').mockResolvedValue(null);
      const switchPinnedStatusSpy = jest.spyOn(
        projectRepository,
        'switchPinnedStatus',
      );

      // Act
      const action = projectService.switchPinnedStatus(projectId, userId, true);

      // Assert
      await expect(action).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        code: ApiCode.RequestError,
        message: '你沒有管理此專案成員的權限',
      });
      expect(switchPinnedStatusSpy).not.toHaveBeenCalled();
    });

    it('專案已封存時拋出 FORBIDDEN 且不更新置頂狀態', async () => {
      // Arrange
      jest.spyOn(projectRepository, 'findMembership').mockResolvedValue({
        ...activeMembership,
        project: {
          ...activeMembership.project,
          archivedAt: new Date('2026-09-20T08:00:00.000Z'),
        },
      });
      const switchPinnedStatusSpy = jest.spyOn(
        projectRepository,
        'switchPinnedStatus',
      );

      // Act
      const action = projectService.switchPinnedStatus(projectId, userId, true);

      // Assert
      await expect(action).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        code: ApiCode.RequestError,
        message: '你沒有管理此專案成員的權限',
      });
      expect(switchPinnedStatusSpy).not.toHaveBeenCalled();
    });

    it('工作區已封存時拋出 FORBIDDEN 且不更新置頂狀態', async () => {
      // Arrange
      jest.spyOn(projectRepository, 'findMembership').mockResolvedValue({
        ...activeMembership,
        project: {
          ...activeMembership.project,
          workspace: {
            archivedAt: new Date('2026-09-20T08:00:00.000Z'),
          },
        },
      });
      const switchPinnedStatusSpy = jest.spyOn(
        projectRepository,
        'switchPinnedStatus',
      );

      // Act
      const action = projectService.switchPinnedStatus(projectId, userId, true);

      // Assert
      await expect(action).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        code: ApiCode.RequestError,
        message: '你沒有管理此專案成員的權限',
      });
      expect(switchPinnedStatusSpy).not.toHaveBeenCalled();
    });

    it('repository 未更新任何成員時拋出 BAD_REQUEST', async () => {
      // Arrange
      jest
        .spyOn(projectRepository, 'findMembership')
        .mockResolvedValue(activeMembership);
      jest.spyOn(projectRepository, 'switchPinnedStatus').mockResolvedValue(0);

      // Act
      const action = projectService.switchPinnedStatus(projectId, userId, true);

      // Assert
      await expect(action).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        code: ApiCode.RequestError,
        message: '更新失敗請重試',
      });
    });
  });
});
