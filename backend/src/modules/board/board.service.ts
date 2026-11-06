import { HttpStatus, Injectable } from '@nestjs/common';
import { BoardRepository } from './board.repository';
import { AddBoardColumnDto } from './dto/addBoardColumn.dto';
import { ProjectService } from '@/modules/project/project.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import type {
  AddCategoryResult,
  ArchiveCardResult,
  BoardCardSnapshot,
  BoardColumnColorKey,
  BoardSnapshot,
  CardCategoryColorKey,
  CardCategorySnapshot,
  CardMutationResult,
} from '@kanban/contracts/board';
import { AddCardDto } from './dto/addCard.dto';
import { UpdateCardDto } from './dto/updateCard.dto';
import { ArchiveCardDto } from './dto/archiveCard.dto';
import { AddCategoryDto } from './dto/addCategory.dto';
import { MoveCardDto } from './dto/moveCard.dto';
import type { Prisma } from '@/generated/prisma/client';

/** Prisma 查出的卡片欄位（日期仍是 Date）。 */
type CardRecord = Omit<BoardCardSnapshot, 'createdAt' | 'updatedAt'> & {
  createdAt: Date;
  updatedAt: Date;
};

/** 轉成回傳給前端的格式：日期改為 ISO 8601 字串。 */
const toCardSnapshot = (card: CardRecord): BoardCardSnapshot => ({
  ...card,
  createdAt: card.createdAt.toISOString(),
  updatedAt: card.updatedAt.toISOString(),
});

/** colorKey is stored as a string; the DTO only ever writes contract keys. */
const toCategorySnapshot = (category: {
  id: string;
  name: string;
  colorKey: string;
}): CardCategorySnapshot => ({
  id: category.id,
  name: category.name,
  colorKey: category.colorKey as CardCategoryColorKey,
});
// import { redisKeys } from '@/infrastructure/redis/redis.keys';

@Injectable()
export class BoardService {
  constructor(
    private readonly boardRepository: BoardRepository,
    private readonly projectService: ProjectService,
    private readonly prismaService: PrismaService,
  ) {}

  /** 創建看板欄 */
  async createBoardColumn(
    addBoardColumnDto: AddBoardColumnDto,
    userId: string,
  ) {
    const membership = await this.projectService.findMembership(
      userId,
      addBoardColumnDto.projectId,
    );
    if (
      !membership ||
      membership.projectArchivedAt !== null ||
      membership.role === 'VIEWER' ||
      membership.workspaceArchivedAt !== null
    ) {
      throw new AppException({
        status: HttpStatus.FORBIDDEN,
        message: '你沒有管理此專案的權限',
        code: ApiCode.RequestError,
      });
    }

    const result = await this.prismaService.$transaction(async (tx) => {
      const boardRevision = await this.boardRepository.incrementBoardRevision(
        addBoardColumnDto.projectId,
        tx,
      );
      const position = await this.boardRepository.getBoardMaxPosition(
        addBoardColumnDto.projectId,
        tx,
      );
      const nextPosition = (position ?? 0) + 1024;
      const column = await this.boardRepository.createBoardColumn(
        addBoardColumnDto,
        nextPosition,
        tx,
      );

      return {
        column,
        boardRevision: boardRevision.toString(),
      };
    });

    return result;
  }

  /** 創建卡片 */
  async createCard(
    dto: AddCardDto,
    userId: string,
  ): Promise<CardMutationResult> {
    const projectAuth = await this.boardRepository.findEditableColumn(
      dto.columnId,
      userId,
    );
    if (projectAuth === null) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到欄位或你沒有存取權限',
        code: ApiCode.ResourceNotFound,
      });
    }
    const projectId = projectAuth.projectId;
    if (dto.categoryId) {
      await this.assertCategoryInProject(dto.categoryId, projectId);
    }
    return await this.prismaService.$transaction(async (tx) => {
      const revision = await this.boardRepository.incrementBoardRevision(
        projectId,
        tx,
      );
      const maxPosition = await this.boardRepository.getCardMaxPosition(
        dto.columnId,
        tx,
      );
      const card = await this.boardRepository.createCard(
        {
          columnId: dto.columnId,
          title: dto.title,
          description: dto.description || null,
          categoryId: dto.categoryId ?? null,
          userId,
          position: (maxPosition ?? 0) + 1024,
        },
        tx,
      );
      return {
        boardRevision: revision.toString(),
        card: toCardSnapshot(card),
      };
    });
  }

  /** 封存卡片；版本不符時回 409 */
  async archiveCard(
    dto: ArchiveCardDto,
    userId: string,
  ): Promise<ArchiveCardResult> {
    const editableCard = await this.boardRepository.findEditableCard(
      dto.cardId,
      userId,
    );
    if (editableCard === null) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到卡片或你沒有存取權限',
        code: ApiCode.ResourceNotFound,
      });
    }
    const projectId = editableCard.column.projectId;

    return await this.prismaService.$transaction(async (tx) => {
      const revision = await this.boardRepository.incrementBoardRevision(
        projectId,
        tx,
      );
      const count = await this.boardRepository.archiveCard(
        dto.cardId,
        dto.expectedVersion,
        tx,
      );
      // 丟錯會讓 transaction rollback，上面遞增的 boardRevision 也一起復原。
      if (count === 0) {
        throw new AppException({
          status: HttpStatus.CONFLICT,
          message: '卡片已被其他人修改，請重新載入',
          code: ApiCode.CardVersionConflict,
        });
      }
      // 卡片已封存，前端只需要 cardId、columnId 把它從畫面上移除。
      return {
        cardId: dto.cardId,
        columnId: editableCard.columnId,
        boardRevision: revision.toString(),
      };
    });
  }

  /** 取得看板欄 */
  async getBoardColumn(
    projectId: string,
    userId: string,
  ): Promise<BoardSnapshot> {
    const result = await this.boardRepository.getAllBoardColumn(
      projectId,
      userId,
    );
    if (result === null) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到專案或你沒有存取權限',
        code: ApiCode.ResourceNotFound,
      });
    }
    return {
      boardRevision: result.boardRevision.toString(),
      currentUserRole: result.members[0].role,
      categories: result.cardCategories.map(toCategorySnapshot),
      columns: result.boardColumns.map(({ cards, ...column }) => ({
        id: column.id,
        title: column.title,
        colorKey: column.colorKey as BoardColumnColorKey,
        position: column.position,
        cards: cards.map(toCardSnapshot),
      })),
    };
  }

  /** 編輯卡片標題／描述／類別；版本不符時回 409 */
  async updateCard(
    dto: UpdateCardDto,
    userId: string,
  ): Promise<CardMutationResult> {
    if (
      dto.title === undefined &&
      dto.description === undefined &&
      dto.categoryId === undefined
    ) {
      throw new AppException({
        status: HttpStatus.BAD_REQUEST,
        message: '請至少修改標題、描述或類別其中一項',
        code: ApiCode.ValidationError,
      });
    }

    const editableCard = await this.boardRepository.findEditableCard(
      dto.cardId,
      userId,
    );
    if (editableCard === null) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到卡片或你沒有存取權限',
        code: ApiCode.ResourceNotFound,
      });
    }
    const projectId = editableCard.column.projectId;
    // null removes the category; only a real id needs the same-project check.
    if (dto.categoryId) {
      await this.assertCategoryInProject(dto.categoryId, projectId);
    }

    return await this.prismaService.$transaction(async (tx) => {
      const revision = await this.boardRepository.incrementBoardRevision(
        projectId,
        tx,
      );
      const count = await this.boardRepository.updateCardContent(
        dto.cardId,
        dto.expectedVersion,
        {
          title: dto.title,
          description:
            dto.description === undefined ? undefined : dto.description || null,
          categoryId: dto.categoryId,
        },
        tx,
      );

      if (count === 0) {
        throw new AppException({
          status: HttpStatus.CONFLICT,
          message: '卡片已被其他人修改，請重新載入',
          code: ApiCode.CardVersionConflict,
        });
      }
      const card = await this.boardRepository.findCardSnapshot(dto.cardId, tx);
      return {
        boardRevision: revision.toString(),
        card: toCardSnapshot(card),
      };
    });
  }

  /**
   * 建立類別；名稱（trim 後不分大小寫）已存在時沿用既有的那一筆，boardRevision 不變（Board 規格 §4.5）。
   */
  async addCategory(
    data: AddCategoryDto,
    userId: string,
  ): Promise<AddCategoryResult> {
    const projectAuth = await this.boardRepository.findEditableProject(
      data.projectId,
      userId,
    );
    if (projectAuth === null) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到專案或你沒有存取權限',
        code: ApiCode.ResourceNotFound,
      });
    }

    const normalizedName = data.name.toLowerCase();

    const result = await this.prismaService.$transaction(async (tx) => {
      const existing = await this.boardRepository.findCategoryByNormalizedName(
        data.projectId,
        normalizedName,
        tx,
      );
      if (existing) {
        const currentRevision = await this.boardRepository.getBoardRevision(
          data.projectId,
          tx,
        );
        return {
          category: toCategorySnapshot(existing),
          boardRevision: currentRevision.toString(),
        };
      }

      const boardRevision = await this.boardRepository.incrementBoardRevision(
        data.projectId,
        tx,
      );
      const count = await this.boardRepository.countCategories(
        data.projectId,
        tx,
      );
      if (count >= 50) {
        throw new AppException({
          status: HttpStatus.CONFLICT,
          message: '這個專案的類別已達 50 個上限',
          code: ApiCode.CardCategoryLimitExceeded,
        });
      }

      const category = await this.boardRepository.createCategory(
        {
          projectId: data.projectId,
          name: data.name,
          normalizedName,
          colorKey: data.colorKey,
        },
        tx,
      );
      return {
        category: toCategorySnapshot(category),
        boardRevision: boardRevision.toString(),
      };
    });
    return result;
  }

  /**
   * 類別必須屬於卡片所在專案（Board 規格 Q12），否則一律 404，不透露 id 是否存在於別的專案。
   * 類別不能刪除（Q7），所以在 transaction 外檢查即可，不會有檢查後被刪掉的競態。
   */
  private async assertCategoryInProject(
    categoryId: string,
    projectId: string,
  ): Promise<void> {
    const category = await this.boardRepository.findCategoryInProject(
      categoryId,
      projectId,
    );
    if (category === null) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到類別',
        code: ApiCode.ResourceNotFound,
      });
    }
  }

  /**
   * 移動卡片到目標欄位的 afterCardId 後面（null 為最上面），Board 規格 §4.3、§5.3。
   * 不檢查也不改變 version；afterCardId 已不在目標欄位時回 409 / CardMoveConflict。
   */
  async moveCard(
    dto: MoveCardDto,
    userId: string,
  ): Promise<CardMutationResult> {
    if (dto.afterCardId === dto.cardId) {
      throw new AppException({
        status: HttpStatus.BAD_REQUEST,
        message: '不能把卡片放在自己後面',
        code: ApiCode.ValidationError,
      });
    }

    const editableCard = await this.boardRepository.findEditableCard(
      dto.cardId,
      userId,
    );
    if (editableCard === null) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到卡片或你沒有存取權限',
        code: ApiCode.ResourceNotFound,
      });
    }
    const projectId = editableCard.column.projectId;

    // Same query as addCard; a column in another project is treated as not found.
    const targetColumn = await this.boardRepository.findEditableColumn(
      dto.toColumnId,
      userId,
    );
    if (targetColumn === null || targetColumn.projectId !== projectId) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到欄位或你沒有存取權限',
        code: ApiCode.ResourceNotFound,
      });
    }

    return await this.prismaService.$transaction(async (tx) => {
      // Lock the project first: everything below reads positions that other moves could change.
      const revision = await this.boardRepository.incrementBoardRevision(
        projectId,
        tx,
      );

      // 0 stands for "above the first card"; real positions are always >= 1.
      let afterPosition = 0;
      if (dto.afterCardId !== null) {
        const position = await this.boardRepository.findCardPositionInColumn(
          dto.afterCardId,
          dto.toColumnId,
          tx,
        );
        if (position === null) {
          throw new AppException({
            status: HttpStatus.CONFLICT,
            message: '看板已被其他人變更，請重新載入',
            code: ApiCode.CardMoveConflict,
          });
        }
        afterPosition = position;
      }

      const position = await this.calculateMovePosition(
        dto.cardId,
        dto.toColumnId,
        dto.afterCardId,
        afterPosition,
        tx,
      );

      const count = await this.boardRepository.moveCard(
        dto.cardId,
        dto.toColumnId,
        position,
        tx,
      );
      // Archived after the permission check; rollback keeps the revision unchanged.
      if (count === 0) {
        throw new AppException({
          status: HttpStatus.NOT_FOUND,
          message: '找不到卡片或你沒有存取權限',
          code: ApiCode.ResourceNotFound,
        });
      }

      const card = await this.boardRepository.findCardSnapshot(dto.cardId, tx);
      return {
        boardRevision: revision.toString(),
        card: toCardSnapshot(card),
      };
    });
  }

  /**
   * 算出卡片在目標欄位的新 position（Board 規格 §4.3）。
   * - afterPosition：前一張卡片的 position；放在最上面時為 0。
   * - 查下一張時一律排除正在移動的卡片（同欄移動時它還佔著舊 position）。
   * 三種情況：
   *   1. 沒有下一張（放最後、或欄位是空的）→ afterPosition + 1024
   *   2. 中間有整數可用 → 取中間值（整數）
   *   3. 相鄰、沒有整數可用 → 整欄重新編號，再重新查 after 與下一張的 position 後計算
   */
  private async calculateMovePosition(
    cardId: string,
    toColumnId: string,
    afterCardId: string | null,
    afterPosition: number,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const nextPosition = await this.boardRepository.findNextCardPosition(
      toColumnId,
      afterPosition,
      cardId,
      tx,
    );
    // 情況1 後面沒有更大的position
    if (nextPosition === null) {
      return afterPosition + 1024;
    }
    // 情況2 下一張有大於1的位置 取平均+下一張的position
    if (nextPosition - afterPosition > 1) {
      return afterPosition + Math.floor((nextPosition - afterPosition) / 2);
    }
    // 情況3 前後兩張相鄰間距為1
    // 重新編排整個column的position
    await this.boardRepository.renumberColumnCards(toColumnId, cardId, tx);

    let renumberAfterPosition: number | null = 0;
    if (afterCardId !== null) {
      renumberAfterPosition =
        await this.boardRepository.findCardPositionInColumn(
          afterCardId,
          toColumnId,
          tx,
        );
    }

    if (renumberAfterPosition === null) {
      // 正常流程不會發生：after 卡片已在同一個 transaction 中查到、project row 已被鎖住，
      // 且重新編號只改 position。若發生代表程式有 bug，因此丟 500 而不是 409。
      throw new Error('重新編號後找不到 after卡片');
    }
    const renumberNextPosition =
      await this.boardRepository.findNextCardPosition(
        toColumnId,
        renumberAfterPosition,
        cardId,
        tx,
      );

    if (renumberNextPosition === null) {
      return renumberAfterPosition + 1024;
    }
    return (
      renumberAfterPosition +
      Math.floor((renumberNextPosition - renumberAfterPosition) / 2)
    );
  }

  /** 移動看板 */
  async moveBoardColumn(_projectId: string) {
    // const lockKey = redisKeys.dragSession(projectId);
  }
}
