import { Module } from '@nestjs/common';
import { WorkspaceInvitationService } from './workspaceInvitation.service';
import { SessionModule } from '@/session/session.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { WorkspaceInvitationRepository } from './workspaceInvitation.repository';

@Module({
  imports: [SessionModule, PrismaModule],
  providers: [WorkspaceInvitationService, WorkspaceInvitationRepository],
  exports: [WorkspaceInvitationService],
})
export class WorkspaceInvitationModule {}
