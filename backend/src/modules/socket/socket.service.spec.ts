import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Server as HttpServer } from 'node:http';
import type { AppConfig } from '@/config';
import type { SessionService } from '@/modules/session/session.service';
import { SocketService } from './socket.service';
import type { SocketRepository } from './socket.repository';

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

type Membership = Awaited<
  ReturnType<SocketRepository['findWorkspaceMembership']>
>;

/** A promise the test resolves by hand, to control when each DB check finishes. */
const createDeferred = () => {
  let resolve!: (value: Membership) => void;
  const promise = new Promise<Membership>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const activeMember: Membership = { workspace: { archivedAt: null } };

type ProjectMembership = Awaited<
  ReturnType<SocketRepository['findProjectMembership']>
>;

const activeProjectMember: ProjectMembership = {
  project: { archivedAt: null, workspace: { archivedAt: null } },
};

/** Same as createDeferred, for the project membership query. */
const createProjectDeferred = () => {
  let resolve!: (value: ProjectMembership) => void;
  const promise = new Promise<ProjectMembership>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

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

const projectRooms = (socket: ReturnType<typeof createFakeSocket>) =>
  [...socket.rooms].filter((room) => room.startsWith('project:'));

describe('SocketService', () => {
  let deferreds: Map<string, ReturnType<typeof createDeferred>>;
  let findWorkspaceMembership: jest.Mock;
  let projectDeferreds: Map<string, ReturnType<typeof createProjectDeferred>>;
  let findProjectMembership: jest.Mock;
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

  /** Resolves the pending membership check for one Project. */
  const finishProjectCheck = async (
    projectId: string,
    member: ProjectMembership = activeProjectMember,
  ) => {
    projectDeferreds.get(projectId)!.resolve(member);
    await flushPromises();
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    deferreds = new Map();
    findWorkspaceMembership = jest.fn(
      (_userId: string, workspaceId: string) => {
        const deferred = createDeferred();
        deferreds.set(workspaceId, deferred);
        return deferred.promise;
      },
    );
    projectDeferreds = new Map();
    findProjectMembership = jest.fn((_userId: string, projectId: string) => {
      const deferred = createProjectDeferred();
      projectDeferreds.set(projectId, deferred);
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
      {
        findWorkspaceMembership,
        findProjectMembership,
      } as unknown as SocketRepository,
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

  it('handshake 驗證後記錄 userId、familyId，target room 皆為 null', () => {
    expect(socket.data).toEqual({
      userId: 'user-1',
      familyId: 'family-1',
      targetWorkspaceId: null,
      targetProjectId: null,
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

    expect(findWorkspaceMembership).toHaveBeenCalledWith('user-1', 'A');
    expect(workspaceRooms(socket)).toEqual(['workspace:A']);
  });

  it('不是成員時不加入 room', async () => {
    socket.handlers['workspace:into']({ workspaceId: 'A' });

    await finishCheck('A', null);

    expect(workspaceRooms(socket)).toEqual([]);
  });

  it('Workspace 已封存時不加入 room', async () => {
    socket.handlers['workspace:into']({ workspaceId: 'A' });

    await finishCheck('A', { workspace: { archivedAt: new Date() } });

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

  describe('project room', () => {
    it('有效成員（含 VIEWER）確認後加入 project room', async () => {
      socket.handlers['project:into']({ projectId: 'P1' });
      expect(projectRooms(socket)).toEqual([]);

      await finishProjectCheck('P1');

      expect(findProjectMembership).toHaveBeenCalledWith('user-1', 'P1');
      expect(projectRooms(socket)).toEqual(['project:P1']);
    });

    it.each([
      ['不是成員', null],
      [
        'Project 已封存',
        {
          project: {
            archivedAt: new Date(),
            workspace: { archivedAt: null },
          },
        },
      ],
      [
        'Workspace 已封存',
        {
          project: {
            archivedAt: null,
            workspace: { archivedAt: new Date() },
          },
        },
      ],
    ] as const)('%s時不加入，並記錄 warn', async (_case, member) => {
      const warn = jest.spyOn(Logger.prototype, 'warn');
      socket.handlers['project:into']({ projectId: 'P1' });

      await finishProjectCheck('P1', member);

      expect(projectRooms(socket)).toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'socket.project.join_rejected',
          projectId: 'P1',
        }),
        '加入專案失敗',
      );
    });

    it('查詢期間離開：查完後不加入', async () => {
      socket.handlers['project:into']({ projectId: 'P1' });
      socket.handlers['project:leave']({ projectId: 'P1' });

      await finishProjectCheck('P1');

      expect(projectRooms(socket)).toEqual([]);
      expect(socket.data.targetProjectId).toBeNull();
    });

    it('P1 → P2 快速切換，P1 先查完：只會在 P2', async () => {
      socket.handlers['project:into']({ projectId: 'P1' });
      socket.handlers['project:leave']({ projectId: 'P1' });
      socket.handlers['project:into']({ projectId: 'P2' });

      await finishProjectCheck('P1');
      await finishProjectCheck('P2');

      expect(projectRooms(socket)).toEqual(['project:P2']);
    });

    it('離開已加入的 project room', async () => {
      socket.handlers['project:into']({ projectId: 'P1' });
      await finishProjectCheck('P1');

      socket.handlers['project:leave']({ projectId: 'P1' });

      expect(projectRooms(socket)).toEqual([]);
      expect(socket.data.targetProjectId).toBeNull();
    });

    it('project room 與 workspace room 互不影響', async () => {
      socket.handlers['workspace:into']({ workspaceId: 'A' });
      socket.handlers['project:into']({ projectId: 'P1' });
      await finishCheck('A');
      await finishProjectCheck('P1');

      socket.handlers['project:leave']({ projectId: 'P1' });

      expect(workspaceRooms(socket)).toEqual(['workspace:A']);
      expect(projectRooms(socket)).toEqual([]);
    });
  });
});
