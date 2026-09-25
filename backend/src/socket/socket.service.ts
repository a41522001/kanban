import { HttpStatus, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Server as HttpServer } from 'node:http';
import { Server, type DefaultEventsMap, type Socket } from 'socket.io';
import type { Env } from '@/config/env';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@kanban/contracts/socket';
import { SessionService } from '@/session/session.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import type { PublicNotification } from '@kanban/contracts/notification';
import { WorkspacesService } from '@/workspaces/workspaces.service';
interface SocketData {
  userId: string;
  session: string;
}

@Injectable()
export class SocketService implements OnModuleDestroy {
  private io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    DefaultEventsMap,
    SocketData
  > | null = null;

  constructor(
    private readonly configService: ConfigService<Env>,
    private readonly sessionService: SessionService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  // #region room
  /** 取得user room */
  private getUserRoom = (userId: string): string => `user:${userId}`;
  /** 取得workspace room */
  private getWorkspaceRoom = (workspaceId: string): string =>
    `workspace:${workspaceId}`;
  /** 取得session room */
  private getSessionRoom = (session: string) => `session:${session}`;
  // #endregion

  initialize(httpServer: HttpServer): void {
    if (this.io) {
      return;
    }
    const frontendURL = this.configService.getOrThrow('FRONTEND_URL', {
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
      await socket.join(this.getSessionRoom(socket.data.session));
      console.log(`a user connected: ${socket.data.userId}`);
      socket.on('demo:echo', (payload) => {
        socket.emit('demo:echoed', {
          text: payload.text,
          serverTime: new Date().toISOString(),
        });
      });
      // 進入工作區
      socket.on('workspace:into', (payload) => {
        void this.authenticateWorkspace(socket, payload.workspaceId)
          .then(() => socket.join(this.getWorkspaceRoom(payload.workspaceId)))
          .catch((error: unknown) => {
            console.error(
              error instanceof Error ? error.message : '工作區驗證失敗',
            );
          });
      });
      // 離開工作區
      socket.on('workspace:leave', (payload) => {
        void socket.leave(this.getWorkspaceRoom(payload.workspaceId));
      });
      // 離線
      socket.on('disconnect', () => {
        console.log(`a user disconnected: ${socket.data.userId}`);
      });
    });
  }

  /** session撤銷後主動斷開socket連線 */
  disconnectSession(sessionId: string): void {
    this.io?.in(this.getSessionRoom(sessionId)).disconnectSockets(true);
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

    const userId =
      await this.sessionService.authenticateSocketSession(sessionId);

    if (!userId) {
      throw new AppException({
        status: HttpStatus.UNAUTHORIZED,
        code: ApiCode.Unauthenticated,
        message: '登入已失效，請重新登入',
      });
    }
    socket.data.session = sessionId;
    socket.data.userId = userId;
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
