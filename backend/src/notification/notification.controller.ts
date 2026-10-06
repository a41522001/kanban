import type { Request } from 'express';
import { Controller, Req, Get, UseGuards, Patch, Body } from '@nestjs/common';
import { NotificationService } from './notification.service';
import type { ApiResult } from '@kanban/contracts/api';
import type { FindByRecipientResponse } from '@kanban/contracts/notification';
import { SessionGuard } from '@/session/session.guard';
import { MarkReadDto } from './dto/markRead.dto';

import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Notifications')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Session 不存在或已失效' })
@Controller('notifications')
@UseGuards(SessionGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @ApiOperation({ summary: '取得目前使用者的通知列表' })
  @ApiOkResponse({ description: '通知列表取得成功' })
  @Get()
  async findByRecipient(
    @Req() req: Request,
  ): Promise<ApiResult<FindByRecipientResponse>> {
    const result = await this.notificationService.findByRecipient({
      recipientUserId: req.userId!,
    });
    return { data: result };
  }

  @ApiOperation({ summary: '取得目前使用者的未讀通知數量' })
  @ApiOkResponse({ description: '未讀通知數量取得成功' })
  @Get('unreadCount')
  async getUnreadCount(
    @Req() req: Request,
  ): Promise<ApiResult<{ count: number }>> {
    const count = await this.notificationService.countUnreadByRecipient(
      req.userId!,
    );
    return { data: { count } };
  }

  @ApiOperation({ summary: '將指定通知標示為已讀' })
  @ApiOkResponse({ description: '通知已標示為已讀；重複操作仍視為成功' })
  @ApiBadRequestResponse({ description: 'notificationId 格式不正確' })
  @ApiNotFoundResponse({ description: '通知不存在或不屬於目前使用者' })
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

  @ApiOperation({ summary: '將目前使用者的所有通知標示為已讀' })
  @ApiOkResponse({ description: '批次更新成功，data 為實際更新筆數' })
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
