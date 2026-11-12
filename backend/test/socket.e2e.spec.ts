import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { Server } from 'socket.io';
import {
  io as connectClient,
  type Socket as ClientSocket,
} from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@kanban/contracts/socket';
import type { ApiResponse } from '@kanban/contracts/api';
import type { CardMutationResult } from '@kanban/contracts/board';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { redisKeys } from '../src/infrastructure/redis/redis.keys';
import { SocketService } from '../src/modules/socket/socket.service';
import { verifyTestUser } from './helpers/verify-test-user';

type Client = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Socket.IO with real clients (docs/architecture/socketio-auth.md §9, Board spec §7):
 * handshake, project room authorization, board broadcasts after commit, and 7.2
 * (logout after rotation disconnects the whole login family).
 */
describe('Socket.IO (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication<App>;
  let baseUrl: string;
  let serverIo: Server;
  let prisma: PrismaService;
  let redis: RedisService;
  const openClients: Client[] = [];

  const users = {
    owner: { email: '', password: 'ownerowner', name: 'socket owner', id: '' },
    viewer: {
      email: '',
      password: 'viewerviewer',
      name: 'socket viewer',
      id: '',
    },
    outsider: {
      email: '',
      password: 'outsideroutsider',
      name: 'socket outsider',
      id: '',
    },
    stranger: {
      email: '',
      password: 'strangerstranger',
      name: 'socket stranger',
      id: '',
    },
  };
  type UserKey = keyof typeof users;
  const fixture = {
    workspaceId: '',
    projectId: '',
    otherProjectId: '',
    columnId: '',
    cardId: '',
  };

  // ---- helpers ----

  const login = async (key: UserKey): Promise<string> => {
    const user = users[key];
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);
    return sessionCookieFrom(response.headers['set-cookie']);
  };

  const sessionCookieFrom = (header: string | string[] | undefined): string => {
    const cookies = Array.isArray(header) ? header : header ? [header] : [];
    const session = cookies.find((cookie) => cookie.startsWith('sessionId='));
    if (!session) throw new Error('response did not set a sessionId cookie');
    return session.split(';')[0];
  };

  const connect = (cookie?: string): Promise<Client> =>
    new Promise((resolve, reject) => {
      const client: Client = connectClient(baseUrl, {
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
        extraHeaders: cookie ? { Cookie: cookie } : {},
      });
      openClients.push(client);
      client.once('connect', () => resolve(client));
      client.once('connect_error', reject);
    });

  const roomsOf = async (client: Client): Promise<Set<string>> => {
    const [serverSocket] = await serverIo.in(client.id!).fetchSockets();
    return new Set(serverSocket?.rooms ?? []);
  };

  /** project:into has no ack, so poll the server until the room membership settles. */
  const waitForRoom = async (
    client: Client,
    room: string,
    expected: boolean,
  ) => {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      if ((await roomsOf(client)).has(room) === expected) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`${room} membership did not become ${expected}`);
  };

  /** A rejected join only logs a warning; give the membership query time to finish. */
  const expectNeverJoins = async (client: Client, room: string) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect((await roomsOf(client)).has(room)).toBe(false);
  };

  const nextEvent = <E extends keyof ServerToClientEvents>(
    client: Client,
    event: E,
  ) =>
    new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`no ${event} within 3s`)),
        3000,
      );
      client.once(event, ((payload: Parameters<ServerToClientEvents[E]>[0]) => {
        clearTimeout(timer);
        resolve(payload);
      }) as never);
    });

  const recordEvents = (client: Client) => {
    const received: string[] = [];
    client.onAny((event: string) => received.push(event));
    return received;
  };

  /** Updates the fixture card through HTTP with its current version; returns the response. */
  const updateCardTitle = async (cookie: string, title: string) => {
    const card = await prisma.card.findUniqueOrThrow({
      where: { id: fixture.cardId },
    });
    return request(app.getHttpServer())
      .patch('/board/updateCard')
      .set('Cookie', cookie)
      .send({ cardId: fixture.cardId, title, expectedVersion: card.version })
      .expect(200);
  };

  // ---- setup ----

  beforeAll(async () => {
    if (process.env.E2E_ENV !== 'true')
      throw new Error('只能使用隔離的 E2E 環境');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.listen(0);
    // main.ts attaches Socket.IO to the HTTP server after listen; do the same here.
    const httpServer = app.getHttpServer() as unknown as HttpServer;
    const socketService = app.get(SocketService);
    socketService.initialize(httpServer);
    // The server instance is private; tests read it only to inspect room membership.
    serverIo = (socketService as unknown as { io: Server }).io;
    baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);

    for (const key of Object.keys(users) as UserKey[]) {
      const user = users[key];
      user.email = `socket-${key}-${randomUUID()}@example.com`;
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: user.email, password: user.password, name: user.name })
        .expect(201);
      await verifyTestUser(app, user.email);
      user.id = (
        await prisma.user.findUniqueOrThrow({ where: { email: user.email } })
      ).id;
    }

    // Fixtures are written directly: the HTTP flows that create them have their own suites.
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Socket workspace',
        createdById: users.owner.id,
        members: {
          create: [
            { userId: users.owner.id, role: 'OWNER' },
            { userId: users.viewer.id, role: 'MEMBER' },
            { userId: users.outsider.id, role: 'MEMBER' },
          ],
        },
      },
    });
    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: 'Socket project',
        createdById: users.owner.id,
        members: {
          create: [
            { userId: users.owner.id, role: 'OWNER' },
            { userId: users.viewer.id, role: 'VIEWER' },
          ],
        },
        boardColumns: {
          create: { title: 'Todo', colorKey: 'coral', position: 1024 },
        },
      },
      include: { boardColumns: true },
    });
    const otherProject = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: 'Other project',
        createdById: users.owner.id,
        members: {
          create: [
            { userId: users.owner.id, role: 'OWNER' },
            { userId: users.outsider.id, role: 'EDITOR' },
          ],
        },
      },
    });
    const card = await prisma.card.create({
      data: {
        columnId: project.boardColumns[0].id,
        title: 'Socket card',
        position: 1024,
        createdById: users.owner.id,
      },
    });
    Object.assign(fixture, {
      workspaceId: workspace.id,
      projectId: project.id,
      otherProjectId: otherProject.id,
      columnId: project.boardColumns[0].id,
      cardId: card.id,
    });
  });

  afterEach(() => {
    while (openClients.length > 0) openClients.pop()!.disconnect();
  });

  afterAll(async () => {
    await app?.close();
  });

  // ---- tests ----

  describe('handshake', () => {
    it('沒有 Session Cookie 時拒絕連線', async () => {
      await expect(connect()).rejects.toThrow();
    });

    it('Session Cookie 無效時拒絕連線', async () => {
      await expect(connect(`sessionId=${randomUUID()}`)).rejects.toThrow();
    });

    it('有效 Session 可連線，加入 user 與 family room，room 名稱不含原始 Session ID', async () => {
      const cookie = await login('viewer');
      const rawSessionId = cookie.slice('sessionId='.length);

      const client = await connect(cookie);
      const rooms = [...(await roomsOf(client))];

      expect(rooms).toContain(`user:${users.viewer.id}`);
      expect(rooms.some((room) => room.startsWith('family:'))).toBe(true);
      expect(rooms.some((room) => room.includes(rawSessionId))).toBe(false);
    });
  });

  describe('project room 權限', () => {
    it('Project VIEWER 可以加入 project room', async () => {
      const client = await connect(await login('viewer'));

      client.emit('project:into', { projectId: fixture.projectId });

      await waitForRoom(client, `project:${fixture.projectId}`, true);
    });

    it('同 Workspace 但不是 Project 成員時不能加入', async () => {
      const client = await connect(await login('outsider'));

      client.emit('project:into', { projectId: fixture.projectId });

      await expectNeverJoins(client, `project:${fixture.projectId}`);
    });

    it('不在 Workspace 的使用者不能加入', async () => {
      const client = await connect(await login('stranger'));

      client.emit('project:into', { projectId: fixture.projectId });

      await expectNeverJoins(client, `project:${fixture.projectId}`);
    });

    it('Workspace 成員可以加入 workspace room，非成員不能', async () => {
      const member = await connect(await login('outsider'));
      const stranger = await connect(await login('stranger'));

      member.emit('workspace:into', { workspaceId: fixture.workspaceId });
      stranger.emit('workspace:into', { workspaceId: fixture.workspaceId });

      await waitForRoom(member, `workspace:${fixture.workspaceId}`, true);
      await expectNeverJoins(stranger, `workspace:${fixture.workspaceId}`);
    });

    it('快速 into(A) → leave(A) → into(B)：最後只在 B', async () => {
      const client = await connect(await login('owner'));

      client.emit('project:into', { projectId: fixture.projectId });
      client.emit('project:leave', { projectId: fixture.projectId });
      client.emit('project:into', { projectId: fixture.otherProjectId });

      await waitForRoom(client, `project:${fixture.otherProjectId}`, true);
      await expectNeverJoins(client, `project:${fixture.projectId}`);
    });
  });

  describe('看板事件廣播（Board 規格 §7.2）', () => {
    it('修改卡片後，room 內的人收到帶 projectId 的事件；HTTP 回應不含 projectId', async () => {
      const ownerCookie = await login('owner');
      const viewer = await connect(await login('viewer'));
      viewer.emit('project:into', { projectId: fixture.projectId });
      await waitForRoom(viewer, `project:${fixture.projectId}`, true);

      const eventPromise = nextEvent(viewer, 'board:cardUpdated');
      const response = await updateCardTitle(ownerCookie, '廣播測試');
      const event = await eventPromise;

      const body = (response.body as ApiResponse<CardMutationResult>).data!;
      expect(event).toEqual({ ...body, projectId: fixture.projectId });
      expect(body).not.toHaveProperty('projectId');
    });

    it('發出修改的人自己也會收到事件（Q4）', async () => {
      const ownerCookie = await login('owner');
      const owner = await connect(ownerCookie);
      owner.emit('project:into', { projectId: fixture.projectId });
      await waitForRoom(owner, `project:${fixture.projectId}`, true);

      const eventPromise = nextEvent(owner, 'board:cardUpdated');
      await updateCardTitle(ownerCookie, '自己也收到');

      expect((await eventPromise).card.title).toBe('自己也收到');
    });

    it('其他專案 room、沒加入 room 的連線都收不到', async () => {
      const ownerCookie = await login('owner');
      const viewer = await connect(await login('viewer'));
      const otherProjectMember = await connect(await login('outsider'));
      const notInAnyRoom = await connect(await login('stranger'));
      viewer.emit('project:into', { projectId: fixture.projectId });
      otherProjectMember.emit('project:into', {
        projectId: fixture.otherProjectId,
      });
      await waitForRoom(viewer, `project:${fixture.projectId}`, true);
      await waitForRoom(
        otherProjectMember,
        `project:${fixture.otherProjectId}`,
        true,
      );
      const otherReceived = recordEvents(otherProjectMember);
      const strangerReceived = recordEvents(notInAnyRoom);

      const viewerEvent = nextEvent(viewer, 'board:cardUpdated');
      await updateCardTitle(ownerCookie, '隔離測試');
      await viewerEvent;
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(otherReceived).toEqual([]);
      expect(strangerReceived).toEqual([]);
    });

    it('離開 project room 後不再收到事件', async () => {
      const ownerCookie = await login('owner');
      const viewer = await connect(await login('viewer'));
      viewer.emit('project:into', { projectId: fixture.projectId });
      await waitForRoom(viewer, `project:${fixture.projectId}`, true);
      viewer.emit('project:leave', { projectId: fixture.projectId });
      await waitForRoom(viewer, `project:${fixture.projectId}`, false);
      const received = recordEvents(viewer);

      await updateCardTitle(ownerCookie, '離開後');
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(received).toEqual([]);
    });

    it('版本衝突（409）時 transaction rollback，不廣播', async () => {
      const ownerCookie = await login('owner');
      const viewer = await connect(await login('viewer'));
      viewer.emit('project:into', { projectId: fixture.projectId });
      await waitForRoom(viewer, `project:${fixture.projectId}`, true);
      const received = recordEvents(viewer);
      const card = await prisma.card.findUniqueOrThrow({
        where: { id: fixture.cardId },
      });

      await request(app.getHttpServer())
        .patch('/board/updateCard')
        .set('Cookie', ownerCookie)
        .send({
          cardId: fixture.cardId,
          title: '過期版本',
          expectedVersion: card.version - 1,
        })
        .expect(409);
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(received).toEqual([]);
    });
  });

  describe('輪轉後登出（socketio-auth.md §7.2）', () => {
    /** Makes the next HTTP request rotate this session (normally after 15 minutes). */
    const forceRotation = async (cookie: string) => {
      const rawId = cookie.slice('sessionId='.length);
      const hash = createHash('sha256').update(rawId).digest('hex');
      await redis.getClient().hSet(redisKeys.session(hash), 'rotateAtMs', '1');
    };

    it('A 連線 → HTTP 輪轉成 B → 以 B 登出：A 的 Socket 被斷開，A、B 都不能再連線；同使用者的另一次登入不受影響', async () => {
      const cookieA = await login('viewer');
      const otherLogin = await login('viewer');
      const socketA = await connect(cookieA);
      const otherSocket = await connect(otherLogin);

      await forceRotation(cookieA);
      const rotated = await request(app.getHttpServer())
        .get('/user/userInfo')
        .set('Cookie', cookieA)
        .expect(200);
      const cookieB = sessionCookieFrom(rotated.headers['set-cookie']);
      expect(cookieB).not.toBe(cookieA);

      const disconnected = new Promise<string>((resolve) =>
        socketA.once('disconnect', resolve),
      );
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookieB)
        .expect(200);

      expect(await disconnected).toBe('io server disconnect');
      await expect(connect(cookieA)).rejects.toThrow();
      await expect(connect(cookieB)).rejects.toThrow();
      expect(otherSocket.connected).toBe(true);
    });
  });
});
