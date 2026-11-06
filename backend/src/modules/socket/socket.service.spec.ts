import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Server as HttpServer } from 'node:http';
import type { AppConfig } from '@/config';
import type { SessionService } from '@/modules/session/session.service';
import type { WorkspacesService } from '@/modules/workspaces/workspaces.service';
import { SocketService } from './socket.service';

type Handler = (...args: any[]) => unknown;

// Captures the middleware and connection handler registered by SocketService.initialize().
const mockServerHandlers: { use?: Handler; connection?: Handler } = {};
const mockDisconnectSockets = jest.fn();
const mockIn = jest.fn(() => ({ disconnectSockets: mockDisconnectSockets }));

jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation(() => ({
    use: (handler: Handler) => {
      mockServerHandlers.use = handler;
    },
    on: (event: string, handler: Handler) => {
      if (event === 'connection') mockServerHandlers.connection = handler;
    },
    in: mockIn,
    close: jest.fn(),
  })),
}));

type Membership = Awaited<ReturnType<WorkspacesService['findMembership']>>;

/** A promise the test resolves by hand, to control when each DB check finishes. */
const createDeferred = () => {
  let resolve!: (value: Membership) => void;
  const promise = new Promise<Membership>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const activeMember = { workspaceArchivedAt: null } as Membership;

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const createFakeSocket = () => {
  const rooms = new Set<string>();
  const handlers: Record<string, Handler> = {};
  return {
    rooms,
    handlers,
    data: {} as Record<string, unknown>,
    handshake: { headers: { cookie: 'sessionId=raw-session' } },
    join: jest.fn((room: string) => {
      rooms.add(room);
      return Promise.resolve();
    }),
    leave: jest.fn((room: string) => {
      rooms.delete(room);
      return Promise.resolve();
    }),
    on: (event: string, handler: Handler) => {
      handlers[event] = handler;
    },
    emit: jest.fn(),
  };
};

const workspaceRooms = (socket: ReturnType<typeof createFakeSocket>) =>
  [...socket.rooms].filter((room) => room.startsWith('workspace:'));

describe('SocketService', () => {
  let deferreds: Map<string, ReturnType<typeof createDeferred>>;
  let findMembership: jest.Mock;
  let authenticateSocketSession: jest.Mock;
  let socket: ReturnType<typeof createFakeSocket>;
  let service: SocketService;

  /** Resolves the pending membership check for one Workspace. */
  const finishCheck = async (
    workspaceId: string,
    member: Membership = activeMember,
  ) => {
    deferreds.get(workspaceId)!.resolve(member);
    await flushPromises();
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    deferreds = new Map();
    findMembership = jest.fn((_userId: string, workspaceId: string) => {
      const deferred = createDeferred();
      deferreds.set(workspaceId, deferred);
      return deferred.promise;
    });
    authenticateSocketSession = jest
      .fn()
      .mockResolvedValue({ userId: 'user-1', familyId: 'family-1' });

    service = new SocketService(
      { get: () => 'http://localhost:5173' } as unknown as ConfigService<
        AppConfig,
        true
      >,
      { authenticateSocketSession } as unknown as SessionService,
      { findMembership } as unknown as WorkspacesService,
    );
    service.initialize({} as HttpServer);

    socket = createFakeSocket();
    const next = jest.fn();
    await mockServerHandlers.use!(socket, next);
    await flushPromises();
    expect(next).toHaveBeenCalledWith();
    await mockServerHandlers.connection!(socket);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('handshake 驗證後記錄 userId、familyId，targetWorkspaceId 為 null', () => {
    expect(socket.data).toEqual({
      userId: 'user-1',
      familyId: 'family-1',
      targetWorkspaceId: null,
    });
  });

  it('連線後加入 user 與 family room，room 名稱不含原始 Session ID', () => {
    expect([...socket.rooms]).toEqual(['user:user-1', 'family:family-1']);
    expect([...socket.rooms].some((room) => room.includes('raw-session'))).toBe(
      false,
    );
  });

  it('disconnectFamily 斷開該 family room 的所有 Socket', () => {
    service.disconnectFamily('family-1');

    expect(mockIn).toHaveBeenCalledWith('family:family-1');
    expect(mockDisconnectSockets).toHaveBeenCalledWith(true);
  });

  it('成員資格確認後加入 Workspace room', async () => {
    socket.handlers['workspace:into']({ workspaceId: 'A' });
    expect(workspaceRooms(socket)).toEqual([]);

    await finishCheck('A');

    expect(findMembership).toHaveBeenCalledWith('user-1', 'A');
    expect(workspaceRooms(socket)).toEqual(['workspace:A']);
  });

  it('不是成員時不加入 room', async () => {
    socket.handlers['workspace:into']({ workspaceId: 'A' });

    await finishCheck('A', null);

    expect(workspaceRooms(socket)).toEqual([]);
  });

  describe('查詢成員資格期間的競速', () => {
    it('查詢期間離開：查完後不加入', async () => {
      socket.handlers['workspace:into']({ workspaceId: 'A' });
      socket.handlers['workspace:leave']({ workspaceId: 'A' });

      await finishCheck('A');

      expect(workspaceRooms(socket)).toEqual([]);
      expect(socket.data.targetWorkspaceId).toBeNull();
    });

    it('A → B 快速切換，A 先查完：只會在 B', async () => {
      socket.handlers['workspace:into']({ workspaceId: 'A' });
      socket.handlers['workspace:leave']({ workspaceId: 'A' });
      socket.handlers['workspace:into']({ workspaceId: 'B' });

      await finishCheck('A');
      await finishCheck('B');

      expect(workspaceRooms(socket)).toEqual(['workspace:B']);
    });

    it('A → B 快速切換，B 先查完：只會在 B', async () => {
      socket.handlers['workspace:into']({ workspaceId: 'A' });
      socket.handlers['workspace:leave']({ workspaceId: 'A' });
      socket.handlers['workspace:into']({ workspaceId: 'B' });

      await finishCheck('B');
      await finishCheck('A');

      expect(workspaceRooms(socket)).toEqual(['workspace:B']);
    });

    it('離開的不是目前要進入的 Workspace 時，不影響目前的加入', async () => {
      socket.handlers['workspace:into']({ workspaceId: 'B' });
      socket.handlers['workspace:leave']({ workspaceId: 'A' });

      await finishCheck('B');

      expect(socket.data.targetWorkspaceId).toBe('B');
      expect(workspaceRooms(socket)).toEqual(['workspace:B']);
    });
  });
});
