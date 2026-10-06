import { Module } from '@nestjs/common';
import { SocketService } from './socket.service';
import { SessionModule } from '@/session/session.module';
import { WorkspacesModule } from '@/workspaces/workspaces.module';

@Module({
  imports: [SessionModule, WorkspacesModule],
  providers: [SocketService],
  exports: [SocketService],
})
export class SocketModule {}
