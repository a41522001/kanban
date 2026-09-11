import { Module } from '@nestjs/common';
import { WorkspaceInvitationService } from './workspaceInvitation.service';
import { SessionModule } from '@/session/session.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { WorkspaceInvitationRepository } from './workspaceInvitation.repository';
import { UserModule } from '@/user/user.module';
import { NotificationModule } from '@/notification/notification.module';
import { WorkspaceInvitationController } from './workspaceInvitation.controller';
import { WorkspacesModule } from '@/workspaces/workspaces.module';
import { WorkspaceInvitationExpirationJob } from './workspaceInvitation.job';

@Module({
  imports: [
    SessionModule,
    PrismaModule,
    UserModule,
    NotificationModule,
    WorkspacesModule,
  ],
  providers: [
    WorkspaceInvitationService,
    WorkspaceInvitationRepository,
    WorkspaceInvitationExpirationJob,
  ],
  exports: [WorkspaceInvitationService],
  controllers: [WorkspaceInvitationController],
})
export class WorkspaceInvitationModule {}
