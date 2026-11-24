import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DateTime } from 'luxon';
import { WorkspaceInvitationService } from './workspaceInvitation.service';
import { LOG_EVENTS } from '@/common/constants/logEvents';
import { RedisLockService } from '@/infrastructure/redis/redisLock.service';
import { redisKeys } from '@/infrastructure/redis/redis.keys';
const EXPIRE_LOCK_TTL_MS = 30_000;
@Injectable()
export class WorkspaceInvitationExpirationJob {
  private readonly logger = new Logger(WorkspaceInvitationExpirationJob.name);
  constructor(
    private readonly workspaceInvitationService: WorkspaceInvitationService,
    private readonly redisLockService: RedisLockService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'expire-workspace-invitations',
    waitForCompletion: true,
  })
  async handleCron(): Promise<void> {
    try {
      const response = await this.redisLockService.withLock<number>(
        redisKeys.cronExpireWorkspaceInvitations(),
        EXPIRE_LOCK_TTL_MS,
        () =>
          this.workspaceInvitationService.expirePendingInvitations(
            DateTime.utc().toJSDate(),
          ),
      );
      if (!response.acquired) {
        return;
      }
      const count = response.result;
      if (count > 0) {
        this.logger.log(
          { event: LOG_EVENTS.workspaceInvitationExpireCompleted, count },
          '已將過期的工作區邀請標記為 EXPIRED',
        );
      }
    } catch (error) {
      this.logger.error(
        { event: LOG_EVENTS.workspaceInvitationExpireFailed, err: error },
        '過期邀請排程執行失敗',
      );
    }
  }
}
