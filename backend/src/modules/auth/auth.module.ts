import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionModule } from '@/modules/session/session.module';
import { UserModule } from '@/modules/user/user.module';
import { SocketModule } from '@/modules/socket/socket.module';
import { QueueModule } from '@/infrastructure/queue/queue.module';
import { RedisModule } from '@/infrastructure/redis/redis.module';
@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [SessionModule, UserModule, SocketModule, QueueModule, RedisModule],
})
export class AuthModule {}
