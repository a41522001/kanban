import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ApiCode, type ApiResponse } from '@kanban/contracts/api';
import type { ProjectListItemDto, ProjectMemberDto } from '@kanban/contracts/project';
import { getProjectMembersApi, getProjectsApi } from '@/services/project';
import { useProjectStore } from '@/stores/project';

vi.mock('@/services/project', () => ({
  createProjectApi: vi.fn(),
  getProjectMembersApi: vi.fn(),
  getProjectsApi: vi.fn(),
}));

const apiResponse = <T>(data: T): ApiResponse<T> => ({
  code: ApiCode.Success,
  message: 'ok',
  time: '',
  data,
  error: null,
});
const project = (id: string, workspaceId: string): ProjectListItemDto => ({
  id,
  workspaceId,
  name: id,
  description: null,
  status: 'ACTIVE',
  createdAt: '2026-09-18T00:00:00.000Z',
  updatedAt: '2026-09-18T00:00:00.000Z',
});

describe('Project Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(getProjectsApi).mockReset();
    vi.mocked(getProjectMembersApi).mockReset();
  });

  it('快速切換 workspace 時忽略較晚回來的舊 response', async () => {
    let resolveFirst!: (value: ApiResponse<ProjectListItemDto[]>) => void;
    vi.mocked(getProjectsApi)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(apiResponse([project('project-b', 'workspace-b')]));
    const store = useProjectStore();

    const first = store.loadProjects('workspace-a');
    await store.loadProjects('workspace-b');
    resolveFirst(apiResponse([project('project-a', 'workspace-a')]));
    await first;

    expect(store.workspaceId).toBe('workspace-b');
    expect(store.projects.map(({ id }) => id)).toEqual(['project-b']);
  });

  it('同一專案的並行 member 請求只送出一次並快取結果', async () => {
    const members: ProjectMemberDto[] = [
      { memberId: 'member-1', displayName: 'Ada', avatarUrl: null, role: 'EDITOR' },
    ];
    vi.mocked(getProjectMembersApi).mockResolvedValue(apiResponse(members));
    const store = useProjectStore();

    const [first, second] = await Promise.all([
      store.loadProjectMembers('project-1'),
      store.loadProjectMembers('project-1'),
    ]);
    const cached = await store.loadProjectMembers('project-1');

    expect(getProjectMembersApi).toHaveBeenCalledTimes(1);
    expect(first).toEqual(members);
    expect(second).toEqual(members);
    expect(cached).toEqual(members);
  });
});
