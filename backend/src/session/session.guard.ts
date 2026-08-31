import { getCookieOptions } from '@/common/utils/cookie';
import type { Env } from '@/config/env';
import { SessionService } from '@/session/session.service';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
@Injectable()
export class SessionGuard implements CanActivate {
  private sessionCookieName: string = 'sessionId';
  private sessionCookieMaxAge: number;
  constructor(
    private readonly configService: ConfigService<Env>,
    private readonly sessionService: SessionService,
  ) {
    this.sessionCookieMaxAge =
      1000 *
      60 *
      60 *
      24 *
      this.configService.getOrThrow('SESSION_EXPIRE_DAY', { infer: true });
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const { sessionId } = request.cookies;
    if (!sessionId || typeof sessionId !== 'string') {
      throw new UnauthorizedException();
    }
    const authResult = await this.sessionService.authenticateSession(sessionId);
    if (authResult === null) {
      throw new UnauthorizedException();
    }
    if (authResult.rotatedSessionId) {
      response.cookie(this.sessionCookieName, authResult.rotatedSessionId, {
        ...getCookieOptions(this.configService),
        maxAge: this.sessionCookieMaxAge,
      });
    }

    request.userId = authResult.userId;
    return true;
  }
}
