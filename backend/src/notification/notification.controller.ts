import type { Request } from 'express';
import { Controller, Req, Get, UseGuards, Patch, Body } from '@nestjs/common';
import { NotificationService } from './notification.service';
import type { ApiResult } from '@kanban/contracts/api';
import type { FindByRecipientResponse } from '@kanban/contracts/notification';
import { SessionGuard } from '@/session/session.guard';
import { MarkReadDto } from './dto/markRead.dto';

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

  @Patch('read')
  async markReadIfUnread(
    @Req() req: Request,
    @Body() markReadDto: MarkReadDto,
  ): Promise<ApiResult<null>> {
    await this.notificationService.markReadIfUnread(
      markReadDto.notificationId,
      req.userId!,
    );

    return {
      data: null,
      message: '更新成功',
    };
  }

  @Patch('readAll')
  async markAllRead(@Req() req: Request): Promise<ApiResult<number>> {
    const count = await this.notificationService.markAllReadByRecipient(
      req.userId!,
    );
    return {
      data: count,
      message: '更新成功',
    };
  }
}
