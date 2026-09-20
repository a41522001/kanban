import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ApiCode, type ApiResponse } from '@kanban/contracts/api';
import type { ProjectMemberAddedNotificationDetail } from '@kanban/contracts/project';
import ProjectMemberAddedNotificationDetailDialog from './ProjectMemberAddedNotificationDetailDialog.vue';
import { i18n } from '@/i18n';
import { getProjectMemberAddedNotificationDetailApi } from '@/services/project';

vi.mock('@/services/project', () => ({
  getProjectMemberAddedNotificationDetailApi:
    vi.fn<
      (notificationId: string) => Promise<ApiResponse<ProjectMemberAddedNotificationDetail>>
    >(),
}));

const detail: ProjectMemberAddedNotificationDetail = {
  role: 'EDITOR',
  projectName: 'Flowboard 即時協作',
  projectId: 'project-1',
  workspaceName: '無限有限公司',
  workspaceId: 'workspace-1',
  inviterName: 'Mina',
  joinedAt: '2026-09-20T05:42:00.000Z',
};

const apiResponse = (data: ProjectMemberAddedNotificationDetail) =>
  ({
    code: ApiCode.Success,
    data,
    message: 'ok',
    time: '2026-09-20T05:42:00.000Z',
    error: null,
  }) satisfies ApiResponse<ProjectMemberAddedNotificationDetail>;

const passthroughStub = { template: '<div><slot /></div>' };
const mountDialog = () =>
  mount(ProjectMemberAddedNotificationDetailDialog, {
    props: {
      open: true,
      notificationId: 'notification-1',
    },
    global: {
      plugins: [i18n],
      stubs: {
        Dialog: passthroughStub,
        DialogContent: passthroughStub,
        DialogTitle: passthroughStub,
        DialogDescription: passthroughStub,
      },
    },
  });

describe('ProjectMemberAddedNotificationDetailDialog', () => {
  beforeEach(() => {
    vi.mocked(getProjectMemberAddedNotificationDetailApi).mockReset();
    vi.mocked(getProjectMemberAddedNotificationDetailApi).mockResolvedValue(apiResponse(detail));
  });

  it('以 notificationId 載入成員詳情並導向對應專案', async () => {
    const wrapper = mountDialog();
    await flushPromises();

    expect(getProjectMemberAddedNotificationDetailApi).toHaveBeenCalledWith('notification-1');
    expect(wrapper.text()).toContain('Flowboard 即時協作');
    expect(wrapper.text()).toContain('無限有限公司');
    expect(wrapper.text()).toContain('編輯者');

    await wrapper.get('.project-member-added-detail-dialog__project-action').trigger('click');

    expect(wrapper.emitted('openProject')).toEqual([[detail]]);
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
  });

  it('載入失敗時顯示錯誤狀態並可重新載入', async () => {
    vi.mocked(getProjectMemberAddedNotificationDetailApi)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(apiResponse(detail));

    const wrapper = mountDialog();
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('無法載入專案資訊');
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();

    expect(getProjectMemberAddedNotificationDetailApi).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('Flowboard 即時協作');
  });
});
