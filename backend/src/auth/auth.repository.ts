import type { User } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import type { CreateUserData } from './auth.type';

@Injectable()
export class AuthRepository {
  constructor(private readonly prismaService: PrismaService) {}
  /** 新增 */
  async create(data: CreateUserData): Promise<void> {
    await this.prismaService.user.create({ data });
  }
  /** 取得 By Email */
  async getByEmail(email: string): Promise<User | null> {
    const user = await this.prismaService.user.findUnique({
      where: {
        email,
      },
    });
    return user;
  }
  /** 取得 By id */
  async getById(id: string): Promise<User | null> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id,
      },
    });
    return user;
  }
  /** 更改username */
  async updateUserName(id: string, username: string) {
    await this.prismaService.user.update({
      where: {
        id,
      },
      data: {
        displayName: username,
      },
    });
  }
  /** 更改avatar */
  async updateAvatar(id: string, url: string) {
    await this.prismaService.user.update({
      where: {
        id,
      },
      data: {
        avatarUrl: url,
      },
    });
  }
}
