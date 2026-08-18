import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthRepository } from './auth.repository';
import { SessionModule } from '@/session/session.module';
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
  imports: [PrismaModule, SessionModule],
})
export class AuthModule {}
