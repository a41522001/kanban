import { Module } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesRepository } from './workspaces.repository';
import { PrismaModule } from '@/prisma/prisma.module';
import { SessionModule } from '@/session/session.module';
import { UserModule } from '@/user/user.module';
import { WorkspaceInvitationModule } from '@/workspaceInvitation/workspaceInvitation.module';
import { NotificationModule } from '@/notification/notification.module';

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspacesRepository],
  imports: [
    PrismaModule,
    SessionModule,
    UserModule,
    WorkspaceInvitationModule,
    NotificationModule,
  ],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
