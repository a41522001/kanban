import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionModule } from '@/session/session.module';
import { UserModule } from '@/user/user.module';
@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [SessionModule, UserModule],
})
export class AuthModule {}
