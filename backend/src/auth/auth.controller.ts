import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response, Request } from 'express';
import type { Env } from '@/config/env';
import type { PublicUser } from '@kanban/contracts/auth';
import { clearCookie, getCookieOptions } from '@/common/utils/cookie';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { SessionGuard } from '@/session/session.guard';
import { ApiResult } from '@kanban/contracts/api';
import { AppException } from '@/common/exceptions/app.exception';

const sessionCookieName = 'sessionId';
const sessionCookieMaxAge = 1000 * 60 * 60 * 24 * 7;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly configService: ConfigService<Env>,
    private readonly authService: AuthService,
  ) {}

  /** 註冊 */
  @ApiOperation({ summary: '使用者註冊' })
  @ApiCreatedResponse({
    description: '註冊成功',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 1 },
        data: { type: 'object', nullable: true, example: null },
        message: { type: 'string', example: '註冊成功' },
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
  @ApiConflictResponse({ description: 'Email 已被註冊' })
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() signupDto: SignupDto): Promise<ApiResult<void>> {
    const isRegistered = await this.authService.signup(signupDto);

    if (!isRegistered) {
      throw new ConflictException('Email 已被註冊');
    }

    return {
      message: '註冊成功',
    };
  }

  /** 登入 */
  @ApiOperation({ summary: '使用者登入' })
  @ApiOkResponse({
    description: '登入成功，並設定 HttpOnly Session Cookie',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 1 },
        data: { type: 'object', nullable: true, example: null },
        message: { type: 'string', example: '登入成功' },
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
  @ApiUnauthorizedResponse({ description: 'Email 或密碼錯誤' })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResult<void>> {
    const sessionId = await this.authService.login(loginDto);

    if (!sessionId) {
      throw new AppException({
        code: 0,
        message: '帳號或密碼錯誤',
        status: 401,
      });
    }

    res.cookie(sessionCookieName, sessionId, {
      ...getCookieOptions(this.configService),
      maxAge: sessionCookieMaxAge,
    });

    return {
      message: '登入成功',
    };
  }

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
    const user = await this.authService.getUserInfo(req.userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return { data: user };
  }

  /** 登出 */
  @ApiOperation({ summary: '登出目前使用者' })
  @ApiCookieAuth()
  @ApiOkResponse({
    description: '登出成功，Session Cookie 已清除',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 1 },
        data: { type: 'object', nullable: true, example: null },
        message: { type: 'string', example: '登出成功' },
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
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResult<void>> {
    const { sessionId } = req.cookies;
    if (typeof sessionId === 'string') {
      await this.authService.logout(sessionId);
    }

    clearCookie(this.configService, res, sessionCookieName);
    return {
      message: '登出成功',
    };
  }
}
