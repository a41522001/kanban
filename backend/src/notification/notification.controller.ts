import type { Request } from 'express';
import { Controller, Req, Get, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import type { ApiResult } from '@kanban/contracts/api';
import type { FindByRecipientResponse } from '@kanban/contracts/notification';
import { SessionGuard } from '@/session/session.guard';

@Controller('notifications')
@UseGuards(SessionGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}
  @Get()
  async findByRecipient(
    @Req() req: Request,
  ): Promise<ApiResult<FindByRecipientResponse>> {
    const result = await this.notificationService.findByRecipient({
      recipientUserId: req.userId!,
    });
    return { data: result };
  }

  @Get('unreadCount')
  async getUnreadCount(
    @Req() req: Request,
  ): Promise<ApiResult<{ count: number }>> {
    const count = await this.notificationService.countUnreadByRecipient(
      req.userId!,
    );
    return { data: { count } };
  }
}
