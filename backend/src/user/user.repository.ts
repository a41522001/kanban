import type { User } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import type { CreateUserData } from './user.type';

@Injectable()
export class UserRepository {
  constructor(private readonly prismaService: PrismaService) {}
  /** 新增 */
  async create(data: CreateUserData): Promise<User> {
    return await this.prismaService.user.create({ data });
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
  /** 更新user為已驗證帳號 */
  async updateVerifiedAccount(id: string, dateTime: Date) {
    // 條件在 DB 內判斷，並行驗證也只會寫入第一次的時間。
    await this.prismaService.user.updateMany({
      where: {
        id,
        authProvider: 'LOCAL',
        emailVerifiedAt: null,
      },
      data: {
        emailVerifiedAt: dateTime,
      },
    });
  }
}
