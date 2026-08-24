import { Injectable } from '@nestjs/common';
import type { LoginRequest, SignupRequest } from '@kanban/contracts/auth';
import { decodePassword, saltPassword } from '@/common/utils';
import { ConfigService } from '@nestjs/config';
import { Env } from '@/config/env';
import { SessionService } from '@/session/session.service';
import { UserService } from '@/user/user.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService<Env>,
    private readonly sessionService: SessionService,
    private readonly userService: UserService,
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

    const isCorrect = await decodePassword(password, user.passwordHash);
    if (isCorrect) {
      const sessionId = await this.sessionService.save(user.id);
      return sessionId;
    }

    return null;
  }
  /** 登出 */
  async logout(sessionId: string): Promise<void> {
    await this.sessionService.delete(sessionId);
  }
}
