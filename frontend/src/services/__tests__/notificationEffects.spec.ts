import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicNotification } from '@kanban/contracts/notification';
import { handleNotificationEffect, syncNotificationResource } from '@/services/notificationEffects';

const { refreshWorkspaces } = vi.hoisted(() => ({
  refreshWorkspaces: vi.fn<() => Promise<void>>(),
}));

vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({ refreshWorkspaces }),
}));

const createNotification = (overrides: Partial<PublicNotification> = {}): PublicNotification =>
  ({
    id: 'notification-1',
    type: 'WORKSPACE_MEMBER_JOINED',
    resourceType: 'WORKSPACE',
    resourceId: 'workspace-1',
    readAt: null,
    expiresAt: null,
    createdAt: '2026-09-16T00:00:00.000Z',
    ...overrides,
  }) as PublicNotification;

describe('notification effects', () => {
  beforeEach(() => {
    refreshWorkspaces.mockReset();
    refreshWorkspaces.mockResolvedValue();
  });

  it('同步 Workspace resource 時刷新 Workspace Store', async () => {
    await syncNotificationResource('WORKSPACE', 'workspace-1');

    expect(refreshWorkspaces).toHaveBeenCalledTimes(1);
  });

  it('收到 Workspace member joined 時同步 Workspace read model', async () => {
    await handleNotificationEffect(createNotification());

    expect(refreshWorkspaces).toHaveBeenCalledTimes(1);
  });

  it('收到 Workspace invitation 時不提前刷新 Workspace', async () => {
    await handleNotificationEffect(
      createNotification({
        type: 'WORKSPACE_INVITED',
        resourceType: 'WORKSPACE_INVITATION',
        resourceId: 'invitation-1',
      }),
    );

    expect(refreshWorkspaces).not.toHaveBeenCalled();
  });

  it('尚未實作的 Project handler 保留為無副作用佔位', async () => {
    await handleNotificationEffect(
      createNotification({
        type: 'PROJECT_MEMBER_ADDED',
        resourceType: 'PROJECT',
        resourceId: 'project-1',
      }),
    );

    expect(refreshWorkspaces).not.toHaveBeenCalled();
  });
});
