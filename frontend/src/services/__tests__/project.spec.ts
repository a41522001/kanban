import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiCode } from '@kanban/contracts/api';
import api from '@/services/http';
import { addProjectMemberApi, getProjectMemberCandidatesApi } from '@/services/project';

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
});
