import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiAcceptedResponse,
  ApiCookieAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response, Request } from 'express';
import type { Env } from '@/config/env';
import { clearCookie, getCookieOptions } from '@/common/utils/cookie';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { ResendVerificationEmailDto } from './dto/resend-verification-email.dto';
import { ApiCode, type ApiResult } from '@kanban/contracts/api';
import type {
  ResendVerificationEmailResult,
  SignupResult,
} from '@kanban/contracts/auth';
import { AppException } from '@/common/exceptions/app.exception';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly configService: ConfigService<Env>,
    private readonly authService: AuthService,
  ) {
    this.sessionCookieMaxAge =
      1000 *
      60 *
      60 *
      24 *
      this.configService.getOrThrow('SESSION_EXPIRE_DAY', { infer: true });
  }
  private sessionCookieName: string = 'sessionId';
  private sessionCookieMaxAge: number;

  /** 註冊 */
  @ApiOperation({ summary: '使用者註冊' })
  @ApiCreatedResponse({
    description: '註冊成功',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 1 },
        data: {
          type: 'object',
          properties: {
            accountCreated: { type: 'boolean', example: true },
            emailQueued: { type: 'boolean', example: true },
            retryAfterSeconds: { type: 'number', example: 60 },
          },
        },
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
  async signup(@Body() signupDto: SignupDto): Promise<ApiResult<SignupResult>> {
    const result = await this.authService.signup(signupDto);

    if (result === false) {
      throw new AppException({
        code: ApiCode.EmailAlreadyRegistered,
        message: 'Email 已被註冊',
        status: HttpStatus.CONFLICT,
      });
    }

    return {
      code: result.emailQueued
        ? ApiCode.Success
        : ApiCode.SignupEmailQueueFailed,
      message: result.emailQueued
        ? '註冊成功'
        : '帳號已建立，驗證信暫時無法寄送，請稍後重寄',
      data: result,
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
  @ApiForbiddenResponse({
    description: '密碼正確，但信箱尚未驗證（EmailVerificationRequired）',
  })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResult<void>> {
    const sessionId = await this.authService.login(loginDto);

    if (!sessionId) {
      throw new AppException({
        code: ApiCode.InvalidCredentials,
        message: '帳號或密碼錯誤',
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    res.cookie(this.sessionCookieName, sessionId, {
      ...getCookieOptions(this.configService),
      maxAge: this.sessionCookieMaxAge,
    });

    return {
      message: '登入成功',
    };
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
    try {
      if (typeof sessionId === 'string') {
        await this.authService.logout(sessionId);
      }
    } finally {
      clearCookie(this.configService, res, this.sessionCookieName);
    }
    return {
      message: '登出成功',
    };
  }
  /** 驗證email */
  @Patch('verify/:token')
  async verifyEmail(@Param('token') token: string): Promise<ApiResult<null>> {
    const result = await this.authService.verifyEmail(token);
    if (result) {
      return {
        message: '驗證成功',
        data: null,
      };
    }

    throw new AppException({
      code: ApiCode.AuthVerifyFail,
      message: '驗證連結無效、已過期或已使用',
      status: HttpStatus.BAD_REQUEST,
    });
  }

  /** 重寄驗證信 */
  @ApiOperation({ summary: '重寄驗證信' })
  @ApiAcceptedResponse({
    description: '重寄申請已受理，data.retryAfterSeconds 為倒數秒數',
  })
  @ApiTooManyRequestsResponse({
    description: '冷卻中，data.retryAfterSeconds 為剩餘秒數',
  })
  @Post('resend-verification-email')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerificationEmail(
    @Body() dto: ResendVerificationEmailDto,
  ): Promise<ApiResult<ResendVerificationEmailResult>> {
    const result = await this.authService.resendVerificationEmail(dto.email);

    return {
      message: '若此信箱有尚未驗證的帳號，我們會寄送驗證信。',
      data: result,
    };
  }
}
