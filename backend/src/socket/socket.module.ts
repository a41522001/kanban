import { Module } from '@nestjs/common';
import { SocketService } from './socket.service';
import { SessionModule } from '@/session/session.module';

@Module({
  imports: [SessionModule],
  providers: [SocketService],
  exports: [SocketService],
})
export class SocketModule {}
