import { Module } from '@nestjs/common';
import { WorkspaceInvitationService } from './workspaceInvitation.service';
import { SessionModule } from '@/modules/session/session.module';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module';
import { WorkspaceInvitationRepository } from './workspaceInvitation.repository';
import { UserModule } from '@/modules/user/user.module';
import { NotificationModule } from '@/modules/notification/notification.module';
import { WorkspaceInvitationController } from './workspaceInvitation.controller';
import { WorkspacesModule } from '@/modules/workspaces/workspaces.module';
import { WorkspaceInvitationExpirationJob } from './workspaceInvitation.job';
import { SocketModule } from '@/modules/socket/socket.module';

@Module({
  imports: [
    SessionModule,
    PrismaModule,
    UserModule,
    NotificationModule,
    WorkspacesModule,
    SocketModule,
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
