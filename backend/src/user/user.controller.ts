import { SessionGuard } from '@/session/session.guard';
import { ApiResult } from '@kanban/contracts/api';
import type { PublicUser } from '@kanban/contracts/user';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { UserService } from './user.service';
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  /** 取得UserInfo */
  @ApiOperation({ summary: '取得目前登入的使用者資訊' })
  @ApiCookieAuth()
  @ApiOkResponse({
    description: '目前登入的使用者資訊',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 1 },
        data: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'jeffery@example.com',
            },
            displayName: { type: 'string', example: 'Jeffery' },
            avatarUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
              example: null,
            },
          },
          required: ['email', 'displayName', 'avatarUrl'],
        },
        message: { type: 'string', example: '請求成功' },
        time: { type: 'string', format: 'date-time' },
        error: {
          type: 'object',
          nullable: true,
          example: null,
          additionalProperties: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      required: ['code', 'data', 'message', 'time', 'error'],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Session 不存在或已失效' })
  @Get('userInfo')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  async userInfo(@Req() req: Request): Promise<ApiResult<PublicUser>> {
    if (!req.userId) {
      throw new UnauthorizedException();
    }
    const user = await this.userService.getUserInfo(req.userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return { data: user };
  }
}
