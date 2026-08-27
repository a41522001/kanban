import { Module } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesRepository } from './workspaces.repository';
import { PrismaModule } from '@/prisma/prisma.module';
import { SessionModule } from '@/session/session.module';

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspacesRepository],
  imports: [PrismaModule, SessionModule],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
