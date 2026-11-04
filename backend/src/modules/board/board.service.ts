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

  /** 移動看板 */
  async moveBoardColumn(_projectId: string) {
    // const lockKey = redisKeys.dragSession(projectId);
  }
}
