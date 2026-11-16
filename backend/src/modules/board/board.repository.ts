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
   * 用於建立類別等專案層級的看板資料；VIEWER、非成員、已封存一律查不到（service 回 404）。
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

  /**
   * 卡片在指定欄位、且未封存時回傳它的 position，否則 null。
   * moveCard 用來確認 afterCardId 還在目標欄位（null → 409 / CardMoveConflict）。
   */
  async findCardPositionInColumn(
    cardId: string,
    columnId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number | null> {
    const db = tx ?? this.prismaService;
    const card = await db.card.findFirst({
      where: { id: cardId, columnId, archivedAt: null },
      select: { position: true },
    });
    return card?.position ?? null;
  }

  /**
   * 欄位中 position 大於 afterPosition 的第一張未封存卡片的 position；沒有時回 null（代表放在最後）。
   * excludeCardId 是正在移動的卡片：同欄內移動時它還留在原位置，不能被當成「下一張」。
   */
  async findNextCardPosition(
    columnId: string,
    afterPosition: number,
    excludeCardId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number | null> {
    const db = tx ?? this.prismaService;
    const card = await db.card.findFirst({
      where: {
        columnId,
        archivedAt: null,
        position: { gt: afterPosition },
        id: { not: excludeCardId },
      },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { position: true },
    });
    return card?.position ?? null;
  }

  /**
   * 把卡片放到指定欄位與 position；不檢查、也不改變 version（Board 規格 §5.3）。
   * @returns 更新筆數；0 代表卡片在檢查權限後被封存。
   */
  async moveCard(
    cardId: string,
    columnId: string,
    position: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const db = tx ?? this.prismaService;
    const result = await db.card.updateMany({
      where: { id: cardId, archivedAt: null },
      data: { columnId, position },
    });
    return result.count;
  }

  /**
   * 把欄位內所有未封存的卡片（排除 excludeCardId）依目前順序重新編號為 1024、2048、3072……
   * （Board 規格 §4.3）；順序是 position asc，position 相同時再依 id asc。
   * 只在「前後兩張相鄰、中間沒有整數可用」時呼叫。tx 必填：重新編號必須與移動卡片在同一個
   * transaction，移動失敗時才會一起 rollback。
   */
  async renumberColumnCards(
    columnId: string,
    excludeCardId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE cards AS c
      SET position = r.rn * 1024
      FROM(
        SELECT id,
          position,
          ROW_NUMBER() OVER (ORDER BY position, id) AS rn
          FROM cards
          WHERE column_id = ${columnId}::uuid
            AND archived_at IS NULL
            AND id <> ${excludeCardId}::uuid
      ) AS r
      WHERE c.id = r.id;
    `;
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

  /**
   * 欄位在指定專案、且未封存時回傳它的 position，否則 null。
   * moveBoardColumn 用來確認 afterColumnId 還在專案內（null → 409 / ColumnMoveConflict）。
   */
  async findColumnPositionInProject(
    columnId: string,
    projectId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number | null> {
    const db = tx ?? this.prismaService;
    const boardColumn = await db.boardColumn.findFirst({
      where: {
        id: columnId,
        projectId,
        archivedAt: null,
      },
      select: {
        position: true,
      },
    });

    return boardColumn?.position ?? null;
  }

  /**
   * 專案中 position 大於 afterPosition 的第一個未封存欄位的 position；沒有時回 null（代表放在最後）。
   * excludeColumnId 是正在移動的欄位：它還留在原位置，不能被當成「下一欄」。
   */
  async findNextColumnPosition(
    projectId: string,
    afterPosition: number,
    excludeColumnId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number | null> {
    const db = tx ?? this.prismaService;
    const nextBoardColumn = await db.boardColumn.findFirst({
      where: {
        id: {
          not: excludeColumnId,
        },
        projectId,
        archivedAt: null,
        position: {
          gt: afterPosition,
        },
      },
      select: {
        position: true,
      },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });

    return nextBoardColumn?.position ?? null;
  }

  /**
   * 把專案內所有未封存的欄位（排除 excludeColumnId）依目前順序重新編號為 1024、2048、3072……
   * （Board 規格 §8.3）；順序是 position asc，position 相同時再依 id asc。
   * 只在「前後兩欄相鄰、中間沒有整數可用」時呼叫。tx 必填：重新編號必須與移動欄位在同一個
   * transaction，移動失敗時才會一起 rollback。
   */
  async renumberProjectColumns(
    projectId: string,
    excludeColumnId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE board_columns AS c
      SET position = r.rn * 1024
      FROM(
        SELECT id,
          position,
          ROW_NUMBER() OVER (ORDER BY position, id) AS rn
          FROM board_columns
          WHERE project_id = ${projectId}::uuid
            AND archived_at IS NULL
            AND id <> ${excludeColumnId}::uuid
      ) AS r
      WHERE c.id = r.id;
    `;
  }

  /**
   * 把欄位放到指定 position（Board 規格 §8.3）。
   * @returns 更新筆數；0 代表欄位在檢查權限後被封存。
   */
  async moveColumn(
    columnId: string,
    position: number,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prismaService;
    const result = await db.boardColumn.updateMany({
      where: { id: columnId, archivedAt: null },
      data: { position },
    });
    return result.count;
  }

  /** 專案內所有未封存欄位的 id 與 position，依 position、id 排序（moveColumn 的回傳，Q15）。 */
  async findColumnPositions(projectId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prismaService;
    return await db.boardColumn.findMany({
      where: { projectId, archivedAt: null },
      select: { id: true, position: true },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
  }
}
