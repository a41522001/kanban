import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiCode } from '@kanban/contracts/api';
import api from '@/services/http';
import {
  addProjectMemberApi,
  getProjectMemberAddedNotificationDetailApi,
  getProjectMemberCandidatesApi,
  setProjectPinnedApi,
} from '@/services/project';

vi.mock('@/services/http', () => ({
  default: vi.fn<typeof api>(),
}));

const mockedApi = vi.mocked(api);

describe('project member service', () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockResolvedValue({
      data: {
        code: ApiCode.Success,
        data: null,
        message: 'ok',
        time: '2026-09-18T00:00:00.000Z',
        error: null,
      },
    } as Awaited<ReturnType<typeof api>>);
  });

  it('依 projectId 取得工作區 member candidates', async () => {
    await getProjectMemberCandidatesApi('project-1');

    expect(mockedApi).toHaveBeenCalledWith({
      url: '/project/project-1/memberCandidates',
      method: 'get',
    });
  });

  it('設定目前使用者的專案置頂狀態', async () => {
    await setProjectPinnedApi('project-1', true);

    expect(mockedApi).toHaveBeenCalledWith({
      url: '/project/project-1/pin',
      method: 'patch',
      data: { pinned: true },
    });
  });

  it('以 workspaceMemberId 與可指派角色新增專案成員', async () => {
    await addProjectMemberApi({
      projectId: 'project-1',
      workspaceMemberId: 'workspace-member-1',
      role: 'EDITOR',
    });

    expect(mockedApi).toHaveBeenCalledWith({
      url: '/project/addMember',
      method: 'post',
      data: {
        projectId: 'project-1',
        workspaceMemberId: 'workspace-member-1',
        role: 'EDITOR',
      },
    });
  });

  it('以 notificationId 取得新增專案成員通知詳情', async () => {
    await getProjectMemberAddedNotificationDetailApi('notification-1');

    expect(mockedApi).toHaveBeenCalledWith({
      url: '/project/notificationDetail/notification-1',
      method: 'get',
    });
  });
});
