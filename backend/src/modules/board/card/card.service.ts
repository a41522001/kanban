import { HttpStatus, Injectable } from '@nestjs/common';
import { BoardRepository } from '../board.repository';
import { CardCategoryService } from '../category/cardCategory.service';
import { SocketService } from '@/modules/socket/socket.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import type {
  ArchiveCardResult,
  CardMutationResult,
} from '@kanban/contracts/board';
import { AddCardDto } from '../dto/addCard.dto';
import { UpdateCardDto } from '../dto/updateCard.dto';
import { ArchiveCardDto } from '../dto/archiveCard.dto';
import { MoveCardDto } from '../dto/moveCard.dto';
import type { Prisma } from '@/generated/prisma/client';
import { positionBetween } from '../boardPosition';
import { toCardSnapshot } from '../board.mappers';

/** 卡片：新增、編輯、封存、移動（Board 規格 §4、§5）。 */
@Injectable()
export class CardService {
  constructor(
    private readonly boardRepository: BoardRepository,
    private readonly cardCategoryService: CardCategoryService,
    private readonly prismaService: PrismaService,
    private readonly socketService: SocketService,
  ) {}

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
      await this.cardCategoryService.assertCategoryInProject(
        dto.categoryId,
        projectId,
      );
    }
    const result = await this.prismaService.$transaction(async (tx) => {
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
    const payload = {
      projectId,
      ...result,
    };
    this.socketService.emitToProject('board:cardCreated', payload);
    return result;
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
      await this.cardCategoryService.assertCategoryInProject(
        dto.categoryId,
        projectId,
      );
    }

    const result = await this.prismaService.$transaction(async (tx) => {
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

    const payload = {
      projectId,
      ...result,
    };
    this.socketService.emitToProject('board:cardUpdated', payload);
    return result;
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

    const result = await this.prismaService.$transaction(async (tx) => {
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

    const payload = {
      ...result,
      projectId,
    };
    this.socketService.emitToProject('board:cardArchived', payload);
    return result;
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

    // 與 addCard 使用同一個查詢；屬於其他專案的欄位視為不存在。
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

    const result = await this.prismaService.$transaction(async (tx) => {
      // 先鎖住專案：後面讀取的 position 都可能被其他人的移動改變。
      const revision = await this.boardRepository.incrementBoardRevision(
        projectId,
        tx,
      );

      // 0 代表「第一張卡片之上」；實際的 position 一定 >= 1。
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
      // 卡片在權限檢查之後被封存；rollback 會讓 revision 維持不變。
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

    const payload = {
      projectId,
      ...result,
    };
    this.socketService.emitToProject('board:cardMoved', payload);
    return result;
  }

  /**
   * 算出卡片在目標欄位的新 position（Board 規格 §4.3）。
   * - afterPosition：前一張卡片的 position；放在最上面時為 0。
   * - 查下一張時一律排除正在移動的卡片（同欄移動時它還佔著舊 position）。
   * 位置的三種情況見 positionBetween；相鄰時整欄重新編號，再重新查 after 與下一張的 position 後計算。
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
    const position = positionBetween(afterPosition, nextPosition);
    if (position !== null) {
      return position;
    }

    // 前後兩張相鄰（間距 1），重新編排整個 column 的 position
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

    const renumberedPosition = positionBetween(
      renumberAfterPosition,
      renumberNextPosition,
    );
    if (renumberedPosition === null) {
      // 重新編號後間距是 POSITION_STEP，不可能再相鄰；發生代表程式有 bug。
      throw new Error('重新編號後卡片仍然相鄰');
    }
    return renumberedPosition;
  }
}
