import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ApiCode, type ApiResponse } from '@kanban/contracts/api';
import type { ProjectListItemDto, ProjectMemberDto } from '@kanban/contracts/project';
import { getProjectMembersApi, getProjectsApi, setProjectPinnedApi } from '@/services/project';
import { useProjectStore } from '@/stores/project';

vi.mock('@/services/project', () => ({
  createProjectApi: vi.fn(),
  getProjectMembersApi: vi.fn(),
  getProjectsApi: vi.fn(),
  setProjectPinnedApi: vi.fn(),
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
  pinnedAt: null,
});

describe('Project Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(getProjectsApi).mockReset();
    vi.mocked(getProjectMembersApi).mockReset();
    vi.mocked(setProjectPinnedApi).mockReset();
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

  it('置頂專案後更新狀態並將專案移到清單前方', async () => {
    vi.mocked(setProjectPinnedApi).mockResolvedValue(apiResponse(null));
    const store = useProjectStore();
    store.projects = [project('project-a', 'workspace-a'), project('project-b', 'workspace-a')];

    await store.setProjectPinned('project-b', true);

    expect(setProjectPinnedApi).toHaveBeenCalledWith('project-b', true);
    expect(store.projects.map(({ id }) => id)).toEqual(['project-b', 'project-a']);
    expect(store.projects[0]?.pinnedAt).not.toBeNull();
  });

  it('取消置頂後清除置頂時間並恢復更新時間排序', async () => {
    vi.mocked(setProjectPinnedApi).mockResolvedValue(apiResponse(null));
    const store = useProjectStore();
    store.projects = [
      { ...project('project-a', 'workspace-a'), pinnedAt: '2026-09-21T00:00:00.000Z' },
      {
        ...project('project-b', 'workspace-a'),
        updatedAt: '2026-09-20T00:00:00.000Z',
      },
    ];

    await store.setProjectPinned('project-a', false);

    expect(setProjectPinnedApi).toHaveBeenCalledWith('project-a', false);
    expect(store.projects.map(({ id }) => id)).toEqual(['project-b', 'project-a']);
    expect(store.projects[1]?.pinnedAt).toBeNull();
  });
});
