import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { AddBoardColumnDto } from './dto/addBoardColumn.dto';
import type { Prisma } from '@/generated/prisma/client';
import { DateTime } from 'luxon';
import type { CardCategoryColorKey } from '@kanban/contracts/board';

/** 寫入資料庫的卡片內容；與 API request 分開定義，description 已正規化為 null。 */
export interface CreateCardData {
  columnId: string;
  title: string;
  description: string | null;
  position: number;
  userId: string;
  /** 已由 service 確認屬於同一專案；沒有類別時為 null。 */
  categoryId: string | null;
}

/** 建立類別時寫入的內容；normalizedName 由 service 計算（trim 後轉小寫），查重與寫入共用同一個值。 */
export interface CreateCategoryData {
  projectId: string;
  name: string;
  normalizedName: string;
  colorKey: CardCategoryColorKey;
}

/** 編輯卡片時要寫入的內容；沒有出現的欄位代表不改，description／categoryId 為 null 代表清空。 */
export interface UpdateCardContentData {
  title?: string;
  description?: string | null;
  categoryId?: string | null;
}

/** 回傳給前端的卡片欄位（對應 contracts 的 BoardCardSnapshot，日期由 service 轉字串）。 */
const CARD_SNAPSHOT_SELECT = {
  id: true,
  columnId: true,
  title: true,
  description: true,
  position: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  categoryId: true,
} satisfies Prisma.CardSelect;

const CATEGORY_SNAPSHOT_SELECT = {
  id: true,
  name: true,
  colorKey: true,
} satisfies Prisma.CardCategorySelect;

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
        categoryId: data.categoryId,
      },
      select: CARD_SNAPSHOT_SELECT,
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
        // Categories are project-wide; the frontend looks up card.categoryId in this list.
        cardCategories: {
          select: CATEGORY_SNAPSHOT_SELECT,
          orderBy: { normalizedName: 'asc' },
        },
        boardRevision: true,
        // Only the current user's membership, to tell the frontend its role.
        members: {
          where: { userId },
          select: { role: true },
        },
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
              select: CARD_SNAPSHOT_SELECT,
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

  /** 找尋可編輯的欄位 */
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

  /** 找尋可編輯的卡片 */
  async findEditableCard(cardId: string, userId: string) {
    const result = await this.prismaService.card.findFirst({
      where: {
        id: cardId,
        archivedAt: null,
        column: {
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
      },
      select: {
        id: true,
        columnId: true,
        column: {
          select: {
            projectId: true,
          },
        },
      },
    });

    return result;
  }

  /**
   * 以 expectedVersion 為條件更新卡片內容，成功時 version +1。
   * 版本檢查與更新在同一個 SQL 完成，不會被其他請求插隊。
   * @returns 更新筆數；0 代表版本不符或卡片已被封存。
   */
  async updateCardContent(
    cardId: string,
    expectedVersion: number,
    data: UpdateCardContentData,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const db = tx ?? this.prismaService;
    const result = await db.card.updateMany({
      where: { id: cardId, version: expectedVersion, archivedAt: null },
      data: { ...data, version: { increment: 1 } },
    });
    return result.count;
  }

  /** 取得單張卡片的 snapshot 欄位；只在確定卡片存在時呼叫，查不到會丟錯。 */
  async findCardSnapshot(cardId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prismaService;
    return await db.card.findUniqueOrThrow({
      where: { id: cardId },
      select: CARD_SNAPSHOT_SELECT,
    });
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

  /** 封存卡片 */
  async archiveCard(
    cardId: string,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const db = tx ?? this.prismaService;
    const result = await db.card.updateMany({
      where: { id: cardId, version: expectedVersion, archivedAt: null },
      data: {
        archivedAt: DateTime.utc().toJSDate(),
        version: { increment: 1 },
      },
    });
    return result.count;
  }

  /** 以正規化名稱找同專案內既有的類別；不存在時回 null。 */
  async findCategoryByNormalizedName(
    projectId: string,
    normalizedName: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prismaService;
    return await db.cardCategory.findUnique({
      where: {
        projectId_normalizedName: {
          projectId,
          normalizedName,
        },
      },
      select: CATEGORY_SNAPSHOT_SELECT,
    });
  }

  /**
   * 確認類別屬於指定專案；不存在或屬於其他專案時回 null（service 回 404，不透露 id 是否存在於別的專案）。
   */
  async findCategoryInProject(
    categoryId: string,
    projectId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prismaService;
    return await db.cardCategory.findFirst({
      where: { id: categoryId, projectId },
      select: { id: true },
    });
  }

  /**
   * 使用者可編輯（OWNER／EDITOR）且專案、工作區都未封存時回傳 { id }，否則 null。
   * 用於建立類別、標籤等專案層級的看板資料；VIEWER、非成員、已封存一律查不到（service 回 404）。
   */
  async findEditableProject(projectId: string, userId: string) {
    return await this.prismaService.project.findFirst({
      where: {
        id: projectId,
        archivedAt: null,
        members: {
          some: {
            userId,
            role: {
              in: ['OWNER', 'EDITOR'],
            },
          },
        },
        workspace: {
          archivedAt: null,
        },
      },
      select: { id: true },
    });
  }

  /** 專案目前的類別數，用於 50 個上限檢查。 */
  async countCategories(projectId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prismaService;
    return await db.cardCategory.count({ where: { projectId } });
  }

  /** 創建類別 */
  async createCategory(
    data: CreateCategoryData,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prismaService;
    return await db.cardCategory.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        normalizedName: data.normalizedName,
        colorKey: data.colorKey,
      },
      select: CATEGORY_SNAPSHOT_SELECT,
    });
  }

  /** 讀取目前的 boardRevision（不遞增），用於沿用既有類別時回傳。 */
  async getBoardRevision(projectId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prismaService;
    const project = await db.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { boardRevision: true },
    });
    return project.boardRevision;
  }
}
