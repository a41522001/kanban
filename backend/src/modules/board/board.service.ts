import { HttpStatus, Injectable } from '@nestjs/common';
import { BoardRepository } from './board.repository';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import type {
  BoardColumnColorKey,
  BoardSnapshot,
} from '@kanban/contracts/board';
import { toCardSnapshot, toCategorySnapshot } from './board.mappers';

/** 讀取整個看板（欄位、卡片、類別與 boardRevision）。 */
@Injectable()
export class BoardService {
  constructor(private readonly boardRepository: BoardRepository) {}

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
}
