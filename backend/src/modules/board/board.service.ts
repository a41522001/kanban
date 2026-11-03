import { HttpStatus, Injectable } from '@nestjs/common';
import { BoardRepository } from './board.repository';
import { AddBoardColumnDto } from './dto/addBoardColumn.dto';
import { ProjectService } from '@/modules/project/project.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import type {
  BoardColumnColorKey,
  BoardSnapshot,
  CardMutationResult,
} from '@kanban/contracts/board';
import { AddCardDto } from './dto/addCard.dto';
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
    const cardAuth = await this.boardRepository.findEditableColumn(
      dto.columnId,
      userId,
    );
    if (cardAuth === null) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到欄位或你沒有存取權限',
        code: ApiCode.ResourceNotFound,
      });
    }
    const projectId = cardAuth.projectId;
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
        card: {
          ...card,
          createdAt: card.createdAt.toISOString(),
          updatedAt: card.updatedAt.toISOString(),
        },
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
        cards: cards.map((card) => ({
          ...card,
          createdAt: card.createdAt.toISOString(),
          updatedAt: card.updatedAt.toISOString(),
        })),
      })),
    };
  }

  /** 移動看板 */
  async moveBoardColumn(_projectId: string) {
    // const lockKey = redisKeys.dragSession(projectId);
  }
}
