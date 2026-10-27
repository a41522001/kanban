import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module';
import { UserRepository } from './user.repository';
import { SessionModule } from '@/modules/session/session.module';

@Module({
  controllers: [UserController],
  providers: [UserService, UserRepository],
  imports: [PrismaModule, SessionModule],
  exports: [UserService],
})
export class UserModule {}
