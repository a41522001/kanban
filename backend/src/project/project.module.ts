import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { ProjectRepository } from './project.repository';
import { WorkspacesModule } from '@/workspaces/workspaces.module';
import { SessionModule } from '@/session/session.module';

@Module({
  imports: [PrismaModule, WorkspacesModule, SessionModule],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectRepository],
})
export class ProjectModule {}
