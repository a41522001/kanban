import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import type { ApiResponse } from '@kanban/contracts/api';
import { ApiCode } from '@kanban/contracts/api';
import type {
  AddProjectMemberRequest,
  MemberCandidate,
  ProjectListItemDto,
} from '@kanban/contracts/project';
import ProjectAddMemberDialog from './ProjectAddMemberDialog.vue';
import { i18n } from '@/i18n';
import { addProjectMemberApi, getProjectMemberCandidatesApi } from '@/services/project';

vi.mock('@/services/project', () => ({
  addProjectMemberApi:
    vi.fn<(data: AddProjectMemberRequest) => Promise<ApiResponse<null>>>(),
  getProjectMemberCandidatesApi:
    vi.fn<(projectId: string) => Promise<ApiResponse<MemberCandidate[]>>>(),
}));
vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn<(message: string) => void>(), error: vi.fn<(message: string) => void>() },
}));

const apiResponse = <T>(data: T): ApiResponse<T> => ({
  code: ApiCode.Success,
  data,
  message: 'ok',
  time: '',
  error: null,
});
const project: ProjectListItemDto = {
  id: 'project-1',
  workspaceId: 'workspace-1',
  name: 'Flowboard',
  description: null,
  status: 'ACTIVE',
  createdAt: '2026-09-18T00:00:00.000Z',
  updatedAt: '2026-09-18T00:00:00.000Z',
  pinnedAt: null,
};
const candidates: MemberCandidate[] = [
  {
    workspaceMemberId: 'workspace-member-owner',
    displayName: 'Jeffery',
    avatarUrl: null,
    projectRole: 'OWNER',
  },
  {
    workspaceMemberId: 'workspace-member-mina',
    displayName: 'Mina',
    avatarUrl: null,
    projectRole: null,
  },
];

const passthroughStub = { template: '<div><slot /></div>' };
const mountDialog = () =>
  mount(ProjectAddMemberDialog, {
    props: {
      open: true,
      project,
      workspaceName: 'Jeffery 的工作區',
      memberCount: 1,
    },
    global: {
      plugins: [i18n],
      stubs: {
        Dialog: passthroughStub,
        DialogContent: passthroughStub,
        DialogHeader: passthroughStub,
        DialogTitle: passthroughStub,
        DialogDescription: passthroughStub,
        DialogFooter: passthroughStub,
      },
    },
  });

describe('ProjectAddMemberDialog', () => {
  beforeEach(() => {
    vi.mocked(getProjectMemberCandidatesApi).mockReset();
    vi.mocked(addProjectMemberApi).mockReset();
    vi.mocked(getProjectMemberCandidatesApi).mockResolvedValue(apiResponse(candidates));
    vi.mocked(addProjectMemberApi).mockResolvedValue(apiResponse(null));
  });

  it('停用已加入者並以 workspaceMemberId 與可指派角色送出', async () => {
    const wrapper = mountDialog();
    await flushPromises();

    const candidateButtons = wrapper.findAll('.project-add-member-dialog__candidate');
    expect(candidateButtons).toHaveLength(2);
    expect(candidateButtons[0]?.attributes('disabled')).toBeDefined();
    expect(candidateButtons[0]?.text()).toContain('已是專案成員');

    await candidateButtons[1]?.trigger('click');
    await wrapper.get('input[value="VIEWER"]').setValue(true);
    await wrapper.get('.project-add-member-dialog__footer button:last-child').trigger('click');
    await flushPromises();

    expect(addProjectMemberApi).toHaveBeenCalledWith({
      projectId: 'project-1',
      workspaceMemberId: 'workspace-member-mina',
      role: 'VIEWER',
    });
    expect(wrapper.emitted('added')).toEqual([['workspace-member-mina']]);
  });

  it('候選人載入失敗時顯示可重試狀態', async () => {
    vi.mocked(getProjectMemberCandidatesApi).mockRejectedValueOnce(new Error('offline'));
    const wrapper = mountDialog();
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('無法載入成員');
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();

    expect(getProjectMemberCandidatesApi).toHaveBeenCalledTimes(2);
    expect(wrapper.findAll('.project-add-member-dialog__candidate')).toHaveLength(2);
  });
});
