import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiCode } from '@kanban/contracts/api';
import api from '@/services/http';
import {
  acceptWorkspaceInvitationApi,
  declineWorkspaceInvitationApi,
  getWorkspaceInvitationDetailApi,
} from '@/services/workspaceInvitation';

vi.mock('@/services/http', () => ({
  default: vi.fn(),
}));

const mockedApi = vi.mocked(api);

describe('workspace invitation response service', () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockResolvedValue({
      data: {
        code: ApiCode.Success,
        data: null,
        message: 'ok',
        time: '2026-09-12T00:00:00.000Z',
        error: null,
      },
    } as Awaited<ReturnType<typeof api>>);
  });

  it('使用共用 request contract 接受邀請', async () => {
    await acceptWorkspaceInvitationApi({ invitationId: 'invitation-1' });

    expect(mockedApi).toHaveBeenCalledWith({
      url: '/workspaceInvitation/accept',
      method: 'post',
      data: { invitationId: 'invitation-1' },
    });
  });

  it('使用共用 request contract 婉拒邀請', async () => {
    await declineWorkspaceInvitationApi({ invitationId: 'invitation-2' });

    expect(mockedApi).toHaveBeenCalledWith({
      url: '/workspaceInvitation/decline',
      method: 'post',
      data: { invitationId: 'invitation-2' },
    });
  });

  it('依 resourceId 取得邀請詳細資訊', async () => {
    await getWorkspaceInvitationDetailApi('invitation-3');

    expect(mockedApi).toHaveBeenCalledWith({
      url: '/workspaceInvitation/invitation-3',
      method: 'get',
    });
  });
});
