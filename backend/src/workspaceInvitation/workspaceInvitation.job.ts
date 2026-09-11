import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DateTime } from 'luxon';
import { WorkspaceInvitationService } from './workspaceInvitation.service';

@Injectable()
export class WorkspaceInvitationExpirationJob {
  private readonly logger = new Logger(WorkspaceInvitationExpirationJob.name);
  constructor(
    private readonly workspaceInvitationService: WorkspaceInvitationService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'expire-workspace-invitations',
    waitForCompletion: true,
  })
  async handleCron(): Promise<void> {
    const now = DateTime.utc().toJSDate();

    const count =
      await this.workspaceInvitationService.expirePendingInvitations(now);

    if (count > 0) {
      this.logger.log(
        `已改變workspace invitations 的 ${count} 筆狀態為Expired `,
      );
    }
  }
}
