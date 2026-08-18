import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { Env } from '@/config/env';
type EchoPayload = {
  text: string;
};

interface ClientToServerEvents {
  'demo:echo': (payload: EchoPayload) => void;
}

interface ServerToClientEvents {
  'demo:echoed': (payload: EchoPayload & { serverTime: string }) => void;
}
@Injectable()
export class SocketService implements OnModuleDestroy {
  private io: Server<ClientToServerEvents, ServerToClientEvents> | null = null;
  constructor(private readonly configService: ConfigService<Env>) {}
  initialize(httpServer: HttpServer): void {
    if (this.io) {
      return;
    }
    const frontendURL = this.configService.getOrThrow('FRONTEND_URL', {
      infer: true,
    });

    this.io = new Server(httpServer, {
      cors: {
        origin: frontendURL,
        credentials: true,
      },
    });

    this.io.on('connection', (socket) => {
      console.log('a user connected');
      socket.on('demo:echo', (payload) => {
        socket.emit('demo:echoed', {
          text: payload.text,
          serverTime: new Date().toISOString(),
        });
      });
      socket.on('disconnect', () => {
        console.log('a user disconnected');
      });
    });
  }
  async onModuleDestroy(): Promise<void> {
    if (!this.io) {
      return;
    }

    await this.io.close();
    this.io = null;
  }
}
