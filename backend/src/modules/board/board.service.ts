import { HttpStatus, Injectable } from '@nestjs/common';
import { BoardRepository } from './board.repository';
import { AddBoardColumnDto } from './dto/addBoardColumn.dto';
import { ProjectService } from '@/modules/project/project.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import type {
  ArchiveCardResult,
  BoardCardSnapshot,
  BoardColumnColorKey,
  BoardSnapshot,
  CardMutationResult,
} from '@kanban/contracts/board';
import { AddCardDto } from './dto/addCard.dto';
import { UpdateCardDto } from './dto/updateCard.dto';
import { ArchiveCardDto } from './dto/archiveCard.dto';

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
          ...dto,
          description: dto.description || null,
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
      columns: result.boardColumns.map(({ cards, ...column }) => ({
        id: column.id,
        title: column.title,
        colorKey: column.colorKey as BoardColumnColorKey,
        position: column.position,
        cards: cards.map(toCardSnapshot),
      })),
    };
  }

  /** 編輯卡片標題／描述；版本不符時回 409 */
  async updateCard(
    dto: UpdateCardDto,
    userId: string,
  ): Promise<CardMutationResult> {
    if (dto.title === undefined && dto.description === undefined) {
      throw new AppException({
        status: HttpStatus.BAD_REQUEST,
        message: '請至少修改標題或描述其中一項',
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

  /** 移動看板 */
  async moveBoardColumn(_projectId: string) {
    // const lockKey = redisKeys.dragSession(projectId);
  }
}
