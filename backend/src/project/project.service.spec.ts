import { ProjectService } from './project.service';

describe('ProjectService member management', () => {
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

  const createService = () => {
    const workspaceService = {
      findMembership: jest.fn(),
      findMembershipById: jest.fn(),
    };
    const notificationService = {
      createNotification: jest.fn(),
      toPublicNotification: jest.fn(),
    };
    const prismaService = { $transaction: jest.fn() };
    const socketService = { emitNotificationCreated: jest.fn() };
    const projectRepository = {
      findMembership: jest.fn(),
      getMemberCandidates: jest.fn(),
      addProjectMember: jest.fn(),
    };

    const service = new ProjectService(
      workspaceService as never,
      notificationService as never,
      prismaService as never,
      socketService as never,
      projectRepository as never,
    );

    return { service, workspaceService, projectRepository };
  };

  it('Project OWNER 可取得同 Workspace 的候選清單', async () => {
    const { service, workspaceService, projectRepository } = createService();
    projectRepository.findMembership.mockResolvedValue(ownerMembership);
    workspaceService.findMembership.mockResolvedValue({
      workspaceArchivedAt: null,
    });
    projectRepository.getMemberCandidates.mockResolvedValue([candidate]);

    await expect(
      service.getMemberCandidates('owner-user', 'project-1'),
    ).resolves.toEqual([candidate]);
    expect(projectRepository.getMemberCandidates).toHaveBeenCalledWith(
      'project-1',
    );
  });

  it('候選清單不公開內部 userId', async () => {
    const { service, workspaceService, projectRepository } = createService();
    projectRepository.findMembership.mockResolvedValue(ownerMembership);
    workspaceService.findMembership.mockResolvedValue({
      workspaceArchivedAt: null,
    });
    projectRepository.getMemberCandidates.mockResolvedValue([
      { ...candidate, userId: 'internal-user-2' },
    ]);

    const result = await service.getMemberCandidates('owner-user', 'project-1');

    expect(result).toEqual([candidate]);
    expect(result[0]).not.toHaveProperty('userId');
  });

  it('Workspace 已封存時不可取得候選清單', async () => {
    const { service, projectRepository } = createService();
    projectRepository.findMembership.mockResolvedValue({
      ...ownerMembership,
      project: {
        ...ownerMembership.project,
        workspace: { archivedAt: new Date() },
      },
    });

    await expect(
      service.getMemberCandidates('owner-user', 'project-1'),
    ).rejects.toMatchObject({ message: '你沒有管理此專案成員的權限' });
    expect(projectRepository.getMemberCandidates).not.toHaveBeenCalled();
  });

  it('拒絕加入其他 Workspace 的 membership', async () => {
    const { service, workspaceService, projectRepository } = createService();
    projectRepository.findMembership.mockResolvedValue(ownerMembership);
    workspaceService.findMembership.mockResolvedValue({
      workspaceArchivedAt: null,
    });
    workspaceService.findMembershipById.mockResolvedValue({
      memberId: 'workspace-member-2',
      userId: 'user-2',
      workspaceId: 'workspace-2',
      workspaceArchivedAt: null,
    });

    await expect(
      service.addProjectMember(
        {
          projectId: 'project-1',
          workspaceMemberId: 'workspace-member-2',
          role: 'EDITOR',
        },
        'owner-user',
      ),
    ).rejects.toMatchObject({ message: '找不到此工作區成員' });
    expect(projectRepository.addProjectMember).not.toHaveBeenCalled();
  });
});
