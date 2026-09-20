import { Test, type TestingModule } from '@nestjs/testing';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import type { Request } from 'express';
import { SessionGuard } from '@/session/session.guard';
import { AddProjectMemberDto } from './dto/addProjectMember.dto';
import {
  ProjectListItemDto,
  ProjectMemberAddedNotificationDetail,
  ProjectMemberDto,
} from '@kanban/contracts/project';

describe('ProjectController', () => {
  let controller: ProjectController;
  let projectService: ProjectService;
  const createRequest = (userId?: string): Request => {
    return { userId } as Request;
  };
  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        {
          provide: ProjectService,
          useValue: {
            createProject: jest.fn(),
            getMemberCandidates: jest.fn(),
            addProjectMember: jest.fn(),
            getSingleProjectMember: jest.fn(),
            getProjectsByWorkspaceIdAndUserId: jest.fn(),
            getProjectMemberAddedNotificationDetail: jest.fn(),
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

    controller = module.get<ProjectController>(ProjectController);
    projectService = module.get<ProjectService>(ProjectService);
  });

  /** 創建專案 */
  describe('createProject', () => {
    it('創建成功', async () => {
      const workspaceId = 'workspaceId';
      const userId = 'testId';
      const request = createRequest(userId);
      const createProjectRequest = {
        name: 'kanban',
        description: 'kanban測試',
        workspaceId,
      };
      const createSpy = jest
        .spyOn(projectService, 'createProject')
        .mockResolvedValueOnce();
      await controller.createProject(request, createProjectRequest);
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith(createProjectRequest, userId);
    });
  });

  /** 取得可加入專案的 Workspace 成員候選 */
  describe('getMemberCandidates', () => {
    it('取得成功', async () => {
      const projectId = 'projectId';
      const userId = 'testId';
      const request = createRequest(userId);
      const candidates = [
        {
          workspaceMemberId: 'workspace-member-1',
          displayName: 'Mina',
          avatarUrl: null,
          projectRole: null,
        },
      ];
      const getMemberCandidatesSpy = jest
        .spyOn(projectService, 'getMemberCandidates')
        .mockResolvedValueOnce(candidates);

      const result = await controller.getMemberCandidates(projectId, request);

      expect(getMemberCandidatesSpy).toHaveBeenCalledWith(userId, projectId);
      expect(result).toEqual({ data: candidates });
    });
  });

  /** 新增專案成員 */
  describe('addProjectMember', () => {
    it('新增成功', async () => {
      const projectId = 'projectId';
      const workspaceMemberId = 'workspaceMemberId';
      const role = 'EDITOR';
      const userId = 'testId';
      const request = createRequest(userId);
      const addProjectMemberRequest: AddProjectMemberDto = {
        projectId,
        workspaceMemberId,
        role,
      };
      const addProjectMemberSpy = jest
        .spyOn(projectService, 'addProjectMember')
        .mockResolvedValueOnce();
      await controller.addProjectMember(request, addProjectMemberRequest);
      expect(addProjectMemberSpy).toHaveBeenCalledTimes(1);
      expect(addProjectMemberSpy).toHaveBeenCalledWith(
        addProjectMemberRequest,
        userId,
      );
    });
  });

  /** 取得單一專案的所有成員 */
  describe('getListProjectMembers', () => {
    it('取得成功', async () => {
      const projectId = 'projectId';
      const userId = 'testId';
      const request = createRequest(userId);
      const members: ProjectMemberDto[] = [
        {
          memberId: '1',
          displayName: '1',
          avatarUrl: null,
          role: 'OWNER',
        },
        {
          memberId: '2',
          displayName: '2',
          avatarUrl: null,
          role: 'EDITOR',
        },
      ];
      const getSingleProjectMemberSpy = jest
        .spyOn(projectService, 'getSingleProjectMember')
        .mockResolvedValueOnce(members);
      const result = await controller.getListProjectMembers(projectId, request);
      expect(getSingleProjectMemberSpy).toHaveBeenCalledTimes(1);
      expect(getSingleProjectMemberSpy).toHaveBeenCalledWith(userId, projectId);
      expect(result.data).toEqual(members);
    });
  });

  /** 取得使用者所屬的專案by workspaceId & userId */
  describe('getProjectsByWorkspaceIdAndUserId', () => {
    it('取得成功', async () => {
      const workspaceId = 'workspaceId';
      const userId = 'testId';
      const request = createRequest(userId);
      const projects: ProjectListItemDto[] = [
        {
          id: '1',
          workspaceId,
          name: 'kanban',
          description: null,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      const getProjectsByWorkspaceIdAndUserIdSpy = jest
        .spyOn(projectService, 'getProjectsByWorkspaceIdAndUserId')
        .mockResolvedValueOnce(projects);
      const result = await controller.getProjectsByWorkspaceIdAndUserId(
        workspaceId,
        request,
      );
      expect(result.data).toEqual(projects);
      expect(getProjectsByWorkspaceIdAndUserIdSpy).toHaveBeenCalledTimes(1);
      expect(getProjectsByWorkspaceIdAndUserIdSpy).toHaveBeenCalledWith(
        workspaceId,
        userId,
      );
    });
  });

  /** 取得專案加入成員通知的詳細資訊 */
  describe('getAddedProjectMemberDetailNotification', () => {
    it('取得成功', async () => {
      const notificationId = 'notificationId';
      const userId = 'testId';
      const request = createRequest(userId);
      const projectMemberAddedNotificationDetail: ProjectMemberAddedNotificationDetail =
        {
          role: 'EDITOR',
          projectName: 'kanban',
          projectId: 'projectId',
          workspaceName: '測試工作區',
          workspaceId: 'workspaceId',
          inviterName: 'Mike',
          joinedAt: new Date().toISOString(),
        };
      const getProjectMemberAddedNotificationDetailSpy = jest
        .spyOn(projectService, 'getProjectMemberAddedNotificationDetail')
        .mockResolvedValueOnce(projectMemberAddedNotificationDetail);
      const result = await controller.getAddedProjectMemberDetailNotification(
        notificationId,
        request,
      );
      expect(result.data).toEqual(projectMemberAddedNotificationDetail);
      expect(getProjectMemberAddedNotificationDetailSpy).toHaveBeenCalledTimes(
        1,
      );
      expect(getProjectMemberAddedNotificationDetailSpy).toHaveBeenCalledWith(
        notificationId,
        userId,
      );
    });
  });
});
