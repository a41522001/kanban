import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Server as HttpServer } from 'node:http';
import type { AppConfig } from '@/config';
import type { SessionService } from '@/modules/session/session.service';
import { SocketService } from './socket.service';
import type { SocketRepository } from './socket.repository';
import type { RedisLockService } from '@/infrastructure/redis/redisLock.service';

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
  role: 'EDITOR',
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

type Broadcast = { room: string; event: string; payload: unknown };

const createFakeSocket = () => {
  const rooms = new Set<string>();
  const handlers: Record<string, Handler> = {};
  const broadcasts: Broadcast[] = [];
  return {
    id: 'socket-1',
    connected: true,
    rooms,
    handlers,
    /** Everything sent through socket.to(room).emit(...), i.e. to the room except this socket. */
    broadcasts,
    to: jest.fn((room: string) => ({
      emit: (event: string, payload: unknown) => {
        broadcasts.push({ room, event, payload });
      },
    })),
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
  let acquireLock: jest.Mock;
  let releaseLock: jest.Mock;
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
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

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
    acquireLock = jest.fn().mockResolvedValue(true);
    releaseLock = jest.fn().mockResolvedValue(true);

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
      {
        acquire: acquireLock,
        release: releaseLock,
      } as unknown as RedisLockService,
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
      draggingCard: null,
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
          role: 'EDITOR',
          project: {
            archivedAt: new Date(),
            workspace: { archivedAt: null },
          },
        },
      ],
      [
        'Workspace 已封存',
        {
          role: 'EDITOR',
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

  describe('卡片拖曳鎖', () => {
    const lockKey = (projectId: string, cardId: string) =>
      `lock:cardDrag:${projectId}:${cardId}`;

    const memberWithRole = (
      role: 'OWNER' | 'EDITOR' | 'VIEWER',
    ): ProjectMembership => ({ ...activeProjectMember, role });

    const enterProject = async (projectId = 'P1') => {
      socket.handlers['project:into']({ projectId });
      await finishProjectCheck(projectId);
    };

    /** Sends card:dragStart and lets the permission query resolve with `member`. */
    const dragStart = async (
      payload: Record<string, unknown>,
      member: ProjectMembership = activeProjectMember,
    ) => {
      const ack = jest.fn();
      socket.handlers['card:dragStart'](payload, ack);
      projectDeferreds.get(payload.projectId as string)?.resolve(member);
      await flushPromises();
      return ack;
    };

    const dragEnd = async (payload: { projectId: string; cardId: string }) => {
      socket.handlers['card:dragEnd'](payload);
      await flushPromises();
    };

    beforeEach(async () => {
      await enterProject('P1');
      findProjectMembership.mockClear();
    });

    describe('card:dragStart', () => {
      it.each(['OWNER', 'EDITOR'] as const)(
        '%s 取得鎖：ack acquired、記錄 draggingCard、廣播給其他人',
        async (role) => {
          const ack = await dragStart(
            { projectId: 'P1', cardId: 'C1' },
            memberWithRole(role),
          );

          expect(findProjectMembership).toHaveBeenCalledWith('user-1', 'P1');
          expect(acquireLock).toHaveBeenCalledWith(
            lockKey('P1', 'C1'),
            'socket-1',
            30000,
          );
          expect(ack).toHaveBeenCalledWith({ status: 'acquired' });
          expect(socket.data.draggingCard).toEqual({
            projectId: 'P1',
            cardId: 'C1',
          });
          expect(socket.broadcasts).toEqual([
            {
              room: 'project:P1',
              event: 'board:cardDragStarted',
              payload: { projectId: 'P1', cardId: 'C1' },
            },
          ]);
        },
      );

      it('廣播只帶 projectId、cardId，不轉發 client 夾帶的其他欄位', async () => {
        await dragStart({
          projectId: 'P1',
          cardId: 'C1',
          injected: '<script>',
        });

        expect(socket.broadcasts[0].payload).toEqual({
          projectId: 'P1',
          cardId: 'C1',
        });
      });

      it.each([
        ['VIEWER', memberWithRole('VIEWER')],
        ['不是成員', null],
        [
          'Project 已封存',
          {
            role: 'EDITOR',
            project: {
              archivedAt: new Date(),
              workspace: { archivedAt: null },
            },
          },
        ],
        [
          'Workspace 已封存',
          {
            role: 'EDITOR',
            project: {
              archivedAt: null,
              workspace: { archivedAt: new Date() },
            },
          },
        ],
      ] as const)(
        '%s：ack locked、不取鎖、不廣播，記錄 warn',
        async (_case, member) => {
          const warn = jest.spyOn(Logger.prototype, 'warn');

          const ack = await dragStart(
            { projectId: 'P1', cardId: 'C1' },
            member,
          );

          expect(ack).toHaveBeenCalledWith({ status: 'locked' });
          expect(acquireLock).not.toHaveBeenCalled();
          expect(socket.broadcasts).toEqual([]);
          expect(socket.data.draggingCard).toBeNull();
          expect(warn).toHaveBeenCalledWith(
            expect.objectContaining({
              event: 'socket.card_drag.rejected',
              projectId: 'P1',
              cardId: 'C1',
              userId: 'user-1',
            }),
            '拖曳卡片被拒絕：沒有權限',
          );
        },
      );

      it('不是目前所在的專案：ack locked，不查 DB', async () => {
        const ack = await dragStart({ projectId: 'P2', cardId: 'C1' });

        expect(ack).toHaveBeenCalledWith({ status: 'locked' });
        expect(findProjectMembership).not.toHaveBeenCalled();
        expect(acquireLock).not.toHaveBeenCalled();
      });

      it('卡片已被別人鎖住：ack locked，不記錄、不廣播', async () => {
        acquireLock.mockResolvedValue(false);

        const ack = await dragStart({ projectId: 'P1', cardId: 'C1' });

        expect(ack).toHaveBeenCalledWith({ status: 'locked' });
        expect(socket.data.draggingCard).toBeNull();
        expect(socket.broadcasts).toEqual([]);
      });

      it('Redis 錯誤：ack unavailable（fail-open），記錄 error', async () => {
        const error = jest.spyOn(Logger.prototype, 'error');
        acquireLock.mockRejectedValue(new Error('redis down'));

        const ack = await dragStart({ projectId: 'P1', cardId: 'C1' });

        expect(ack).toHaveBeenCalledWith({ status: 'unavailable' });
        expect(socket.broadcasts).toEqual([]);
        expect(error).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'socket.card_drag.lock_failed',
            projectId: 'P1',
            cardId: 'C1',
          }),
          '取得卡片拖曳鎖失敗',
        );
      });

      it('DB 錯誤：ack unavailable', async () => {
        findProjectMembership.mockRejectedValueOnce(new Error('db down'));
        const ack = jest.fn();

        socket.handlers['card:dragStart'](
          { projectId: 'P1', cardId: 'C1' },
          ack,
        );
        await flushPromises();

        expect(ack).toHaveBeenCalledWith({ status: 'unavailable' });
        expect(acquireLock).not.toHaveBeenCalled();
      });

      it('沒有帶 ack callback 時直接忽略', async () => {
        socket.handlers['card:dragStart']({ projectId: 'P1', cardId: 'C1' });
        await flushPromises();

        expect(findProjectMembership).not.toHaveBeenCalled();
        expect(acquireLock).not.toHaveBeenCalled();
      });

      it('已持有另一張卡片的鎖：先釋放舊鎖並廣播結束，再取得新鎖', async () => {
        await dragStart({ projectId: 'P1', cardId: 'C1' });
        socket.broadcasts.length = 0;

        const ack = await dragStart({ projectId: 'P1', cardId: 'C2' });

        expect(releaseLock).toHaveBeenCalledWith(
          lockKey('P1', 'C1'),
          'socket-1',
        );
        expect(releaseLock.mock.invocationCallOrder[0]).toBeLessThan(
          acquireLock.mock.invocationCallOrder[1],
        );
        expect(socket.broadcasts).toEqual([
          {
            room: 'project:P1',
            event: 'board:cardDragEnded',
            payload: { projectId: 'P1', cardId: 'C1' },
          },
          {
            room: 'project:P1',
            event: 'board:cardDragStarted',
            payload: { projectId: 'P1', cardId: 'C2' },
          },
        ]);
        expect(ack).toHaveBeenCalledWith({ status: 'acquired' });
        expect(socket.data.draggingCard).toEqual({
          projectId: 'P1',
          cardId: 'C2',
        });
      });

      it('舊鎖已過期（release 回 false）：不廣播舊卡片結束', async () => {
        await dragStart({ projectId: 'P1', cardId: 'C1' });
        socket.broadcasts.length = 0;
        releaseLock.mockResolvedValue(false);

        await dragStart({ projectId: 'P1', cardId: 'C2' });

        expect(socket.broadcasts.map((b) => b.event)).toEqual([
          'board:cardDragStarted',
        ]);
      });

      it('取鎖期間斷線：立刻釋放剛取得的鎖，不記錄、不廣播', async () => {
        acquireLock.mockImplementation(() => {
          socket.connected = false;
          return Promise.resolve(true);
        });

        await dragStart({ projectId: 'P1', cardId: 'C1' });

        expect(releaseLock).toHaveBeenCalledWith(
          lockKey('P1', 'C1'),
          'socket-1',
        );
        expect(socket.data.draggingCard).toBeNull();
        expect(socket.broadcasts).toEqual([]);
      });
    });

    describe('card:dragEnd', () => {
      it('釋放目前持有的鎖並廣播結束', async () => {
        await dragStart({ projectId: 'P1', cardId: 'C1' });
        socket.broadcasts.length = 0;

        await dragEnd({ projectId: 'P1', cardId: 'C1' });

        expect(releaseLock).toHaveBeenCalledWith(
          lockKey('P1', 'C1'),
          'socket-1',
        );
        expect(socket.data.draggingCard).toBeNull();
        expect(socket.broadcasts).toEqual([
          {
            room: 'project:P1',
            event: 'board:cardDragEnded',
            payload: { projectId: 'P1', cardId: 'C1' },
          },
        ]);
      });

      it('鎖已過期或被別人取得（release 回 false）：清掉記錄，不廣播', async () => {
        await dragStart({ projectId: 'P1', cardId: 'C1' });
        socket.broadcasts.length = 0;
        releaseLock.mockResolvedValue(false);

        await dragEnd({ projectId: 'P1', cardId: 'C1' });

        expect(socket.data.draggingCard).toBeNull();
        expect(socket.broadcasts).toEqual([]);
      });

      it('不是目前持有的卡片（例如晚到的舊事件）：不釋放、不清掉記錄', async () => {
        await dragStart({ projectId: 'P1', cardId: 'C2' });

        await dragEnd({ projectId: 'P1', cardId: 'C1' });

        expect(releaseLock).not.toHaveBeenCalled();
        expect(socket.data.draggingCard).toEqual({
          projectId: 'P1',
          cardId: 'C2',
        });
      });

      it('沒有持有鎖時不呼叫 Redis', async () => {
        await dragEnd({ projectId: 'P1', cardId: 'C1' });

        expect(releaseLock).not.toHaveBeenCalled();
      });

      it('Redis 錯誤時記錄 error，不讓錯誤外漏', async () => {
        const error = jest.spyOn(Logger.prototype, 'error');
        await dragStart({ projectId: 'P1', cardId: 'C1' });
        releaseLock.mockRejectedValue(new Error('redis down'));

        await dragEnd({ projectId: 'P1', cardId: 'C1' });

        expect(error).toHaveBeenCalledWith(
          expect.objectContaining({ event: 'socket.card_drag.lock_failed' }),
          '釋放卡片拖曳鎖失敗',
        );
      });
    });

    describe('disconnect', () => {
      it('斷線時釋放持有的鎖並廣播結束', async () => {
        await dragStart({ projectId: 'P1', cardId: 'C1' });
        socket.broadcasts.length = 0;

        socket.handlers['disconnect']();
        await flushPromises();

        expect(releaseLock).toHaveBeenCalledWith(
          lockKey('P1', 'C1'),
          'socket-1',
        );
        expect(socket.broadcasts).toEqual([
          {
            room: 'project:P1',
            event: 'board:cardDragEnded',
            payload: { projectId: 'P1', cardId: 'C1' },
          },
        ]);
      });

      it('沒有持有鎖時不呼叫 Redis', async () => {
        socket.handlers['disconnect']();
        await flushPromises();

        expect(releaseLock).not.toHaveBeenCalled();
      });

      it('Redis 錯誤時記錄 error，不讓錯誤外漏', async () => {
        const error = jest.spyOn(Logger.prototype, 'error');
        await dragStart({ projectId: 'P1', cardId: 'C1' });
        releaseLock.mockRejectedValue(new Error('redis down'));

        socket.handlers['disconnect']();
        await flushPromises();

        expect(error).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'socket.card_drag.lock_failed',
            userId: 'user-1',
          }),
          '斷線時釋放卡片拖曳鎖失敗',
        );
      });
    });
  });
});
