import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { ProjectRepository } from './project.repository';
import { WorkspacesModule } from '@/workspaces/workspaces.module';
import { SessionModule } from '@/session/session.module';
import { NotificationModule } from '@/notification/notification.module';
import { SocketModule } from '@/socket/socket.module';

@Module({
  imports: [
    PrismaModule,
    WorkspacesModule,
    SessionModule,
    NotificationModule,
    SocketModule,
  ],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectRepository],
})
export class ProjectModule {}
