import { Injectable } from '@nestjs/common';
import type { LoginRequest, SignupRequest } from '@kanban/contracts/auth';
import { decodePassword, saltPassword } from '@/common/utils';
import { ConfigService } from '@nestjs/config';
import { Env } from '@/config/env';
import { SessionService } from '@/session/session.service';
import { UserService } from '@/user/user.service';
import { SocketService } from '@/socket/socket.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService<Env>,
    private readonly sessionService: SessionService,
    private readonly userService: UserService,
    private readonly socketService: SocketService,
  ) {}

  /** 註冊 */
  async signup(data: SignupRequest): Promise<boolean> {
    const { email, password, name } = data;
    const user = await this.userService.getByEmail(email);
    if (user) {
      return false;
    }
    const passwordHash = await saltPassword(password, this.configService);
    await this.userService.createUser({
      email,
      passwordHash,
      displayName: name,
    });
    return true;
  }
  /** 登入 */
  async login(data: LoginRequest): Promise<string | null> {
    const { email, password } = data;
    const user = await this.userService.getByEmail(email);
    if (!user) {
      return null;
    }
    if (user.authProvider !== 'LOCAL' || user.passwordHash === null) {
      return null;
    }
    const isCorrect = await decodePassword(password, user.passwordHash);
    if (isCorrect) {
      const sessionId = await this.sessionService.saveCurrentSession(user.id);
      return sessionId;
    }

    return null;
  }
  /** 登出 */
  async logout(sessionId: string): Promise<void> {
    await this.sessionService.revokeSession(sessionId);
    this.socketService.disconnectSession(sessionId);
  }
}
