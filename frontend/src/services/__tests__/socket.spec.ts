import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (...args: unknown[]) => void;

const emitWithAck = vi.fn<(event: string, payload?: unknown) => Promise<unknown>>();

const fakeSocket = {
  connected: false,
  handlers: new Map<string, Handler[]>(),
  on: vi.fn<(event: string, handler: Handler) => void>(),
  off: vi.fn<(event: string, handler: Handler) => void>(),
  emit: vi.fn<(event: string, payload?: unknown) => void>(),
  emitWithAck,
  // socket.timeout(ms) returns an emitter whose emitWithAck rejects after ms without an ack.
  timeout: vi.fn((_ms: number) => ({ emitWithAck })),
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

  describe('卡片拖曳鎖（Board 規格 §8.2）', () => {
    const payload = { projectId: 'project-1', cardId: 'card-1' };

    beforeEach(() => {
      fakeSocket.connected = true;
      fakeSocket.emitWithAck.mockReset();
      fakeSocket.timeout.mockClear();
    });

    afterEach(() => {
      fakeSocket.connected = false;
    });

    it.each(['acquired', 'locked', 'unavailable'] as const)(
      'emitCardDragStart 帶逾時送出並回傳 ack 的 %s',
      async (status) => {
        const socket = await loadModule();
        fakeSocket.emitWithAck.mockResolvedValue({ status });

        await expect(socket.emitCardDragStart(payload)).resolves.toBe(status);

        expect(fakeSocket.timeout).toHaveBeenCalledWith(socket.CARD_DRAG_ACK_TIMEOUT_MS);
        expect(fakeSocket.emitWithAck).toHaveBeenCalledWith('card:dragStart', payload);
      },
    );

    it('ack 逾時或出錯時回 unavailable（fail-open）', async () => {
      const socket = await loadModule();
      fakeSocket.emitWithAck.mockRejectedValue(new Error('operation has timed out'));

      await expect(socket.emitCardDragStart(payload)).resolves.toBe('unavailable');
    });

    it('斷線時不送出 dragStart，直接回 unavailable（避免重連後才送出）', async () => {
      const socket = await loadModule();
      fakeSocket.connected = false;

      await expect(socket.emitCardDragStart(payload)).resolves.toBe('unavailable');
      expect(fakeSocket.emitWithAck).not.toHaveBeenCalled();
    });

    it('emitCardDragEnd：連線時送出，斷線時不送', async () => {
      const socket = await loadModule();

      socket.emitCardDragEnd(payload);
      expect(fakeSocket.emit).toHaveBeenCalledExactlyOnceWith('card:dragEnd', payload);

      fakeSocket.emit.mockClear();
      fakeSocket.connected = false;
      socket.emitCardDragEnd(payload);
      expect(fakeSocket.emit).not.toHaveBeenCalled();
    });

    it('onCardDragEvents／offCardDragEvents 註冊與移除同一組 handlers', async () => {
      const socket = await loadModule();
      const handlers = {
        'board:cardDragStarted': vi.fn(),
        'board:cardDragEnded': vi.fn(),
      };

      socket.onCardDragEvents(handlers);
      socket.offCardDragEvents(handlers);

      expect(fakeSocket.on).toHaveBeenCalledWith(
        'board:cardDragStarted',
        handlers['board:cardDragStarted'],
      );
      expect(fakeSocket.on).toHaveBeenCalledWith(
        'board:cardDragEnded',
        handlers['board:cardDragEnded'],
      );
      expect(fakeSocket.off).toHaveBeenCalledWith(
        'board:cardDragStarted',
        handlers['board:cardDragStarted'],
      );
      expect(fakeSocket.off).toHaveBeenCalledWith(
        'board:cardDragEnded',
        handlers['board:cardDragEnded'],
      );
    });
  });
});
