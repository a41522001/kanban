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

interface SocketData {
  userId: string;
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
  ) {}

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

    this.io.use((socket, next) => {
      void this.authenticateSocket(socket)
        .then(() => next())
        .catch((error: unknown) => {
          next(error instanceof Error ? error : new Error('Socket 驗證失敗'));
        });
    });

    this.io.on('connection', (socket) => {
      void socket.join(this.getUserRoom(socket.data.userId));
      console.log(`a user connected: ${socket.data.userId}`);
      socket.on('demo:echo', (payload) => {
        socket.emit('demo:echoed', {
          text: payload.text,
          serverTime: new Date().toISOString(),
        });
      });
      socket.on('disconnect', () => {
        console.log(`a user disconnected: ${socket.data.userId}`);
      });
    });
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

    const authResult = await this.sessionService.authenticateSession(sessionId);

    if (!authResult) {
      throw new AppException({
        status: HttpStatus.UNAUTHORIZED,
        code: ApiCode.Unauthenticated,
        message: '登入已失效，請重新登入',
      });
    }

    socket.data.userId = authResult.userId;
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

  /** 取得user room */
  private getUserRoom = (userId: string): string => `user:${userId}`;

  async onModuleDestroy(): Promise<void> {
    if (!this.io) {
      return;
    }

    await this.io.close();
    this.io = null;
  }
}
