import { Module } from '@nestjs/common';
import { WorkspaceInvitationService } from './workspaceInvitation.service';
import { SessionModule } from '@/session/session.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { WorkspaceInvitationRepository } from './workspaceInvitation.repository';
import { UserModule } from '@/user/user.module';
import { NotificationModule } from '@/notification/notification.module';
import { WorkspaceInvitationController } from './workspaceInvitation.controller';
import { WorkspacesModule } from '@/workspaces/workspaces.module';

@Module({
  imports: [
    SessionModule,
    PrismaModule,
    UserModule,
    NotificationModule,
    WorkspacesModule,
  ],
  providers: [WorkspaceInvitationService, WorkspaceInvitationRepository],
  exports: [WorkspaceInvitationService],
  controllers: [WorkspaceInvitationController],
})
export class WorkspaceInvitationModule {}
