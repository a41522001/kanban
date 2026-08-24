import { Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env';
import { CreateUserData } from './user.type';
import type { User } from '@/generated/prisma/client';
import type { PublicUser } from '@kanban/contracts/user';

@Injectable()
export class UserService {
  constructor(
    private readonly configService: ConfigService<Env>,
    private userRepository: UserRepository,
  ) {}
  /** 創建User */
  async createUser(data: CreateUserData) {
    await this.userRepository.create(data);
  }
  /** 取得User by id */
  async getByEmail(email: string): Promise<User | null> {
    return await this.userRepository.getByEmail(email);
  }
  /** 取得UserInfo */
  async getUserInfo(userId: string): Promise<PublicUser | null> {
    const user = await this.userRepository.getById(userId);
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
}
