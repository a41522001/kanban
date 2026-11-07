import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (...args: unknown[]) => void;

const fakeSocket = {
  connected: false,
  handlers: new Map<string, Handler[]>(),
  on: vi.fn<(event: string, handler: Handler) => void>(),
  off: vi.fn<(event: string, handler: Handler) => void>(),
  emit: vi.fn<(event: string, payload?: unknown) => void>(),
  connect: vi.fn<() => void>(),
  disconnect: vi.fn<() => void>(),
};

fakeSocket.on.mockImplementation((event, handler) => {
  const list = fakeSocket.handlers.get(event) ?? [];
  list.push(handler);
  fakeSocket.handlers.set(event, list);
});

vi.mock('socket.io-client', () => ({ io: () => fakeSocket }));

/** Simulates the server accepting a (re)connection. */
const fireConnect = () => {
  fakeSocket.handlers.get('connect')?.forEach((handler) => handler());
};

const loadModule = async () => {
  vi.resetModules();
  fakeSocket.handlers.clear();
  return import('../socket');
};

describe('socket service', () => {
  beforeEach(() => {
    fakeSocket.emit.mockClear();
  });

  it('重連時重新加入目前的 Workspace room', async () => {
    const socket = await loadModule();
    socket.emitWorkspaceInto('workspace-1');
    fakeSocket.emit.mockClear();

    fireConnect();

    expect(fakeSocket.emit).toHaveBeenCalledExactlyOnceWith('workspace:into', {
      workspaceId: 'workspace-1',
    });
  });

  it('切換 Workspace 後重連只加入新的 room', async () => {
    const socket = await loadModule();
    socket.emitWorkspaceInto('workspace-1');
    socket.emitWorkspaceLeave('workspace-1');
    socket.emitWorkspaceInto('workspace-2');
    fakeSocket.emit.mockClear();

    fireConnect();

    expect(fakeSocket.emit).toHaveBeenCalledExactlyOnceWith('workspace:into', {
      workspaceId: 'workspace-2',
    });
  });

  it('離開 Workspace 後重連不補送', async () => {
    const socket = await loadModule();
    socket.emitWorkspaceInto('workspace-1');
    socket.emitWorkspaceLeave('workspace-1');
    fakeSocket.emit.mockClear();

    fireConnect();

    expect(fakeSocket.emit).not.toHaveBeenCalled();
  });

  it('離開的不是目前的 Workspace 時保留目前的 room', async () => {
    const socket = await loadModule();
    socket.emitWorkspaceInto('workspace-2');
    socket.emitWorkspaceLeave('workspace-1');
    fakeSocket.emit.mockClear();

    fireConnect();

    expect(fakeSocket.emit).toHaveBeenCalledExactlyOnceWith('workspace:into', {
      workspaceId: 'workspace-2',
    });
  });

  it('disconnect（登出）後重新連線不補送前一個使用者的 Workspace', async () => {
    const socket = await loadModule();
    socket.emitWorkspaceInto('workspace-1');
    socket.disconnect();
    fakeSocket.emit.mockClear();

    fireConnect();

    expect(fakeSocket.emit).not.toHaveBeenCalled();
  });

  describe('project room', () => {
    it('重連時同時補送 Workspace 與 Project room', async () => {
      const socket = await loadModule();
      socket.emitWorkspaceInto('workspace-1');
      socket.emitProjectInto('project-1');
      fakeSocket.emit.mockClear();

      fireConnect();

      expect(fakeSocket.emit.mock.calls).toEqual([
        ['workspace:into', { workspaceId: 'workspace-1' }],
        ['project:into', { projectId: 'project-1' }],
      ]);
    });

    it('切換專案後重連只加入新的 project room', async () => {
      const socket = await loadModule();
      socket.emitProjectInto('project-1');
      socket.emitProjectLeave('project-1');
      socket.emitProjectInto('project-2');
      fakeSocket.emit.mockClear();

      fireConnect();

      expect(fakeSocket.emit).toHaveBeenCalledExactlyOnceWith('project:into', {
        projectId: 'project-2',
      });
    });

    it('離開的不是目前的專案時保留目前的 room', async () => {
      const socket = await loadModule();
      socket.emitProjectInto('project-2');
      socket.emitProjectLeave('project-1');
      fakeSocket.emit.mockClear();

      fireConnect();

      expect(fakeSocket.emit).toHaveBeenCalledExactlyOnceWith('project:into', {
        projectId: 'project-2',
      });
    });

    it('disconnect（登出）後重新連線不補送專案', async () => {
      const socket = await loadModule();
      socket.emitProjectInto('project-1');
      socket.disconnect();
      fakeSocket.emit.mockClear();

      fireConnect();

      expect(fakeSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('onReconnected', () => {
    it('第一次連線不呼叫，之後每次重連都呼叫', async () => {
      const socket = await loadModule();
      const handler = vi.fn<() => void>();
      socket.onReconnected(handler);

      fireConnect();
      expect(handler).not.toHaveBeenCalled();

      fireConnect();
      fireConnect();
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('先補送 workspace:into 再通知重連', async () => {
      const socket = await loadModule();
      const calls: string[] = [];
      fakeSocket.emit.mockImplementation((event) => calls.push(event));
      socket.onReconnected(() => calls.push('reconnected'));
      fireConnect();
      socket.emitWorkspaceInto('workspace-1');
      calls.length = 0;

      fireConnect();

      expect(calls).toEqual(['workspace:into', 'reconnected']);
      fakeSocket.emit.mockReset();
    });

    it('offReconnected 後不再呼叫', async () => {
      const socket = await loadModule();
      const handler = vi.fn<() => void>();
      socket.onReconnected(handler);
      socket.offReconnected(handler);

      fireConnect();
      fireConnect();

      expect(handler).not.toHaveBeenCalled();
    });

    it('disconnect（登出）後下一次連線視為第一次連線', async () => {
      const socket = await loadModule();
      const handler = vi.fn<() => void>();
      socket.onReconnected(handler);
      fireConnect();

      socket.disconnect();
      fireConnect();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  it('連線與斷線時更新 isConnected', async () => {
    const socket = await loadModule();

    fireConnect();
    expect(socket.isConnected.value).toBe(true);

    fakeSocket.handlers.get('disconnect')?.forEach((handler) => handler());
    expect(socket.isConnected.value).toBe(false);
  });
});
