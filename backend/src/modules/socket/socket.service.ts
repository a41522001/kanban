import {
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Server as HttpServer } from 'node:http';
import { Server, type DefaultEventsMap, type Socket } from 'socket.io';
import type { AppConfig } from '@/config';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@kanban/contracts/socket';
import { SessionService } from '@/modules/session/session.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import type { PublicNotification } from '@kanban/contracts/notification';
import { WorkspacesService } from '@/modules/workspaces/workspaces.service';
import { LOG_EVENTS } from '@/common/constants/logEvents';
import { SocketRepository } from './socket.repository';
interface SocketData {
  userId: string;
  familyId: string;
  targetWorkspaceId: string | null;
  targetProjectId: string | null;
}

@Injectable()
export class SocketService implements OnModuleDestroy {
  private io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    DefaultEventsMap,
    SocketData
  > | null = null;
  private readonly logger = new Logger(SocketService.name);
  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly sessionService: SessionService,
    private readonly workspacesService: WorkspacesService,
    private readonly socketRepository: SocketRepository,
  ) {}

  // #region room
  /** 取得user room */
  private getUserRoom = (userId: string): string => `user:${userId}`;
  /** 取得workspace room */
  private getWorkspaceRoom = (workspaceId: string): string =>
    `workspace:${workspaceId}`;
  /** 取得project room */
  private getProjectRoom = (projectId: string): string =>
    `project:${projectId}`;
  /** 取得family room */
  private getFamilyRoom = (familyId: string) => `family:${familyId}`;
  // #endregion

  initialize(httpServer: HttpServer): void {
    if (this.io) {
      return;
    }
    const frontendURL = this.configService.get('app.frontendUrl', {
      infer: true,
    });

    this.io = new Server<
      ClientToServerEvents,
      ServerToClientEvents,
      DefaultEventsMap,
      SocketData
    >(httpServer, {
      cors: {
        origin: frontendURL,
        credentials: true,
      },
    });
    // socket middleware
    this.io.use((socket, next) => {
      void this.authenticateSocket(socket)
        .then(() => next())
        .catch((error: unknown) => {
          next(error instanceof Error ? error : new Error('Socket 驗證失敗'));
        });
    });
    // 連線
    this.io.on('connection', async (socket) => {
      await socket.join(this.getUserRoom(socket.data.userId));
      await socket.join(this.getFamilyRoom(socket.data.familyId));
      this.logger.log(
        {
          event: LOG_EVENTS.socketConnectionConnected,
          userId: socket.data.userId,
        },
        'Socket 已連線',
      );
      socket.on('demo:echo', (payload) => {
        socket.emit('demo:echoed', {
          text: payload.text,
          serverTime: new Date().toISOString(),
        });
      });
      // 進入工作區
      socket.on('workspace:into', (payload) => {
        socket.data.targetWorkspaceId = payload.workspaceId;
        void this.authenticateWorkspace(socket, payload.workspaceId)
          .then(() => {
            if (payload.workspaceId !== socket.data.targetWorkspaceId) {
              return;
            }
            return socket.join(this.getWorkspaceRoom(payload.workspaceId));
          })
          .catch((error: unknown) => {
            this.logger.warn(
              {
                event: LOG_EVENTS.socketWorkspaceJoinRejected,
                err: error,
                workspaceId: payload.workspaceId,
              },
              '加入工作區失敗',
            );
          });
      });
      // 離開工作區
      socket.on('workspace:leave', (payload) => {
        void socket.leave(this.getWorkspaceRoom(payload.workspaceId));
        if (socket.data.targetWorkspaceId === payload.workspaceId) {
          socket.data.targetWorkspaceId = null;
        }
      });
      // 進入專案
      socket.on('project:into', (payload) => {
        socket.data.targetProjectId = payload.projectId;
        void this.authenticateProject(socket, payload.projectId)
          .then(() => {
            if (payload.projectId !== socket.data.targetProjectId) {
              return;
            }
            return socket.join(this.getProjectRoom(payload.projectId));
          })
          .catch((error: unknown) => {
            this.logger.warn(
              {
                event: LOG_EVENTS.socketProjectJoinRejected,
                err: error,
                projectId: payload.projectId,
              },
              '加入專案失敗',
            );
          });
      });
      // 離開專案
      socket.on('project:leave', (payload) => {
        void socket.leave(this.getProjectRoom(payload.projectId));
        if (socket.data.targetProjectId === payload.projectId) {
          socket.data.targetProjectId = null;
        }
      });
      // 離線
      socket.on('disconnect', () => {
        this.logger.log(
          {
            event: LOG_EVENTS.socketConnectionDisconnected,
            userId: socket.data.userId,
          },
          'Socket 已斷線',
        );
      });
    });
  }

  /** 登出後斷開同一次登入（family）的所有 Socket，包含輪轉前建立的連線 */
  disconnectFamily(familyId: string): void {
    this.io?.in(this.getFamilyRoom(familyId)).disconnectSockets(true);
  }

  /** 推播工作區成員改變 */
  emitWorkspaceMemberChanged(workspaceId: string): void {
    if (!this.io) {
      return;
    }
    this.io
      .to(this.getWorkspaceRoom(workspaceId))
      .emit('workspace:memberChanged', { workspaceId });
  }

  /** 推播通知 */
  emitNotificationCreated(
    inviteeId: string,
    notification: PublicNotification,
  ): void {
    if (!this.io) {
      return;
    }
    this.io
      ?.to(this.getUserRoom(inviteeId))
      .emit('notification:created', notification);
  }

  /** 驗證socket */
  private authenticateSocket = async (
    socket: Socket<
      ClientToServerEvents,
      ServerToClientEvents,
      DefaultEventsMap,
      SocketData
    >,
  ): Promise<void> => {
    const sessionId = this.getSessionIdFromCookie(
      socket.handshake.headers.cookie,
    );

    if (!sessionId) {
      throw new AppException({
        status: HttpStatus.UNAUTHORIZED,
        code: ApiCode.Unauthenticated,
        message: '登入已失效，請重新登入',
      });
    }

    const sessionResult =
      await this.sessionService.authenticateSocketSession(sessionId);

    if (sessionResult === null) {
      throw new AppException({
        status: HttpStatus.UNAUTHORIZED,
        code: ApiCode.Unauthenticated,
        message: '登入已失效，請重新登入',
      });
    }
    socket.data.familyId = sessionResult.familyId;
    socket.data.userId = sessionResult.userId;
    socket.data.targetWorkspaceId = null;
    socket.data.targetProjectId = null;
  };

  /** 驗證工作區 */
  private authenticateWorkspace = async (
    socket: Socket<
      ClientToServerEvents,
      ServerToClientEvents,
      DefaultEventsMap,
      SocketData
    >,
    workspaceId: string,
  ): Promise<void> => {
    const member = await this.workspacesService.findMembership(
      socket.data.userId,
      workspaceId,
    );
    if (!member || member.workspaceArchivedAt !== null) {
      throw new AppException({
        status: HttpStatus.FORBIDDEN,
        code: ApiCode.RequestError,
        message: '你沒有存取此工作區的權限',
      });
    }
  };

  /** 驗證專案 */
  private authenticateProject = async (
    socket: Socket<
      ClientToServerEvents,
      ServerToClientEvents,
      DefaultEventsMap,
      SocketData
    >,
    projectId: string,
  ): Promise<void> => {
    const member = await this.socketRepository.findProjectMembership(
      socket.data.userId,
      projectId,
    );

    if (
      member === null ||
      member.project.archivedAt !== null ||
      member.project.workspace.archivedAt !== null
    ) {
      throw new AppException({
        status: HttpStatus.FORBIDDEN,
        code: ApiCode.RequestError,
        message: '你沒有存取此專案的權限',
      });
    }
  };

  /** 從cookie取得sessionId */
  private getSessionIdFromCookie = (
    cookieHeader: string | undefined,
  ): string | null => {
    const sessionCookie = cookieHeader
      ?.split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith('sessionId='));
    if (!sessionCookie) {
      return null;
    }
    const sessionId = sessionCookie.slice('sessionId='.length);
    return sessionId.length > 0 ? sessionId : null;
  };

  async onModuleDestroy(): Promise<void> {
    if (!this.io) {
      return;
    }

    await this.io.close();
    this.io = null;
  }
}
