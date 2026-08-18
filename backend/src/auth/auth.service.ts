import { Injectable } from '@nestjs/common';
import { AuthRepository } from './auth.repository';
import type {
  LoginRequest,
  PublicUser,
  SignupRequest,
} from '@kanban/contracts/auth';
import { decodePassword, saltPassword } from '@/common/utils';
import { ConfigService } from '@nestjs/config';
import { Env } from '@/config/env';
import { SessionService } from '@/session/session.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService<Env>,
    private readonly sessionService: SessionService,
    private readonly authRepository: AuthRepository,
  ) {}

  /** 註冊 */
  async signup(data: SignupRequest): Promise<boolean> {
    const { email, password, name } = data;
    const user = await this.authRepository.getByEmail(email);
    if (user) {
      return false;
    }
    const passwordHash = await saltPassword(password, this.configService);
    await this.authRepository.create({
      email,
      passwordHash,
      displayName: name,
    });
    return true;
  }
  /** 登入 */
  async login(data: LoginRequest): Promise<string | null> {
    const { email, password } = data;
    const user = await this.authRepository.getByEmail(email);
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
  /** 取得UserInfo */
  async getUserInfo(userId: string): Promise<PublicUser | null> {
    const user = await this.authRepository.getById(userId);
    if (!user) {
      return null;
    }
    const { email, displayName, avatarUrl } = user;
    return {
      email,
      displayName,
      avatarUrl,
    };
  }
  /** 登出 */
  async logout(sessionId: string): Promise<void> {
    await this.sessionService.delete(sessionId);
  }
}
