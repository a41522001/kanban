import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { AddBoardColumnDto } from './dto/addBoardColumn.dto';
import type { Prisma } from '@/generated/prisma/client';

/** 寫入資料庫的卡片內容；與 API request 分開定義，description 已正規化為 null。 */
export interface CreateCardData {
  columnId: string;
  title: string;
  description: string | null;
  position: number;
  userId: string;
}

@Injectable()
export class BoardRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /** 建立看板欄 */
  async createBoardColumn(
    addBoardColumnDto: AddBoardColumnDto,
    position: number,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prismaService;
    return await db.boardColumn.create({
      data: {
        ...addBoardColumnDto,
        position,
      },
    });
  }

  /** 建立卡片 */
  async createCard(data: CreateCardData, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prismaService;
    return await db.card.create({
      data: {
        columnId: data.columnId,
        title: data.title,
        description: data.description,
        createdById: data.userId,
        position: data.position,
      },
      select: {
        id: true,
        columnId: true,
        title: true,
        description: true,
        position: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /** 取得所有看板欄 by projectId */
  async getAllBoardColumn(projectId: string, userId: string) {
    const result = await this.prismaService.project.findFirst({
      where: {
        id: projectId,
        archivedAt: null,
        workspace: { archivedAt: null },
        members: {
          some: { userId },
        },
      },
      select: {
        boardRevision: true,
        boardColumns: {
          where: {
            archivedAt: null,
          },
          select: {
            id: true,
            title: true,
            colorKey: true,
            position: true,
            version: true,
            cards: {
              select: {
                id: true,
                columnId: true,
                title: true,
                description: true,
                position: true,
                version: true,
                createdAt: true,
                updatedAt: true,
              },
              where: {
                archivedAt: null,
              },
              orderBy: [
                {
                  position: 'asc',
                },
                {
                  updatedAt: 'desc',
                },
              ],
            },
          },
          orderBy: [
            {
              position: 'asc',
            },
            {
              updatedAt: 'desc',
            },
          ],
        },
      },
    });
    return result;
  }

  async findEditableColumn(columnId: string, userId: string) {
    const result = await this.prismaService.boardColumn.findFirst({
      where: {
        id: columnId,
        archivedAt: null,
        project: {
          archivedAt: null,
          workspace: {
            archivedAt: null,
          },
          members: {
            some: {
              userId,
              role: {
                in: ['EDITOR', 'OWNER'],
              },
            },
          },
        },
      },
      select: { id: true, projectId: true },
    });

    return result;
  }

  /** 取得卡片最大position by columnId*/
  async getCardMaxPosition(columnId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prismaService;
    const result = await db.card.aggregate({
      where: {
        columnId,
        archivedAt: null,
      },
      _max: {
        position: true,
      },
    });

    return result._max.position;
  }

  /** 取得看板最大position by projectId*/
  async getBoardMaxPosition(
    projectId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number | null> {
    const db = tx ?? this.prismaService;
    const result = await db.boardColumn.aggregate({
      where: {
        projectId,
        archivedAt: null,
      },
      _max: {
        position: true,
      },
    });

    return result._max.position;
  }

  /** 鎖定 Project 並遞增 Board revision */
  async incrementBoardRevision(
    projectId: string,
    tx: Prisma.TransactionClient,
  ) {
    const project = await tx.project.update({
      where: {
        id: projectId,
        archivedAt: null,
      },
      data: {
        boardRevision: {
          increment: 1,
        },
      },
      select: {
        boardRevision: true,
      },
    });

    return project.boardRevision;
  }
}
