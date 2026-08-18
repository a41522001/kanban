import { SessionService } from '@/session/session.service';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const { sessionId } = request.cookies;
    if (!sessionId || typeof sessionId !== 'string') {
      throw new UnauthorizedException();
    }
    const session = await this.sessionService.get(sessionId);
    if (!session || !session?.userId) {
      throw new UnauthorizedException();
    }

    request.userId = session.userId;
    return true;
  }
}
