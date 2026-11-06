import { Module } from '@nestjs/common';
import { SocketService } from './socket.service';
import { SessionModule } from '@/modules/session/session.module';
import { WorkspacesModule } from '@/modules/workspaces/workspaces.module';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module';
import { SocketRepository } from './socket.repository';

@Module({
  imports: [PrismaModule, SessionModule, WorkspacesModule],
  providers: [SocketService, SocketRepository],
  exports: [SocketService],
})
export class SocketModule {}
