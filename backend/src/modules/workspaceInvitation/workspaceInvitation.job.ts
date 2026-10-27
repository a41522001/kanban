import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DateTime } from 'luxon';
import { WorkspaceInvitationService } from './workspaceInvitation.service';
import { LOG_EVENTS } from '@/common/constants/logEvents';

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
        { event: LOG_EVENTS.workspaceInvitationExpireCompleted, count },
        '已將過期的工作區邀請標記為 EXPIRED',
      );
    }
  }
}
