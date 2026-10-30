import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { AddBoardColumnDto } from './dto/addBoardColumn.dto';
import type { BoardColumn, Prisma } from '@/generated/prisma/client';

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

  /** 取得所有看板欄 by projectId */
  async getAllBoardColumn(
    projectId: string,
    userId: string,
  ): Promise<BoardColumn[] | null> {
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
        boardColumns: {
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
    });
    return result?.boardColumns ?? null;
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
