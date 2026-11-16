import { HttpStatus, Injectable } from '@nestjs/common';
import { BoardRepository } from '../board.repository';
import { AddBoardColumnDto } from '../dto/addBoardColumn.dto';
import { MoveBoardColumnDto } from '../dto/moveBoardColumn.dto';
import { ProjectService } from '@/modules/project/project.service';
import { SocketService } from '@/modules/socket/socket.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import type {
  AddColumnResult,
  BoardColumnColorKey,
  MoveColumnResult,
} from '@kanban/contracts/board';
import type { Prisma } from '@/generated/prisma/client';
import { positionBetween } from '../boardPosition';

/** 看板欄位：新增、移動（Board 規格 §8.3）。 */
@Injectable()
export class BoardColumnService {
  constructor(
    private readonly boardRepository: BoardRepository,
    private readonly projectService: ProjectService,
    private readonly prismaService: PrismaService,
    private readonly socketService: SocketService,
  ) {}

  /** 創建看板欄 */
  async createBoardColumn(
    addBoardColumnDto: AddBoardColumnDto,
    userId: string,
  ): Promise<AddColumnResult> {
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
        column: {
          id: column.id,
          title: column.title,
          colorKey: column.colorKey as BoardColumnColorKey,
          position: column.position,
          cards: [],
        },
        boardRevision: boardRevision.toString(),
      };
    });

    const payload = {
      projectId: addBoardColumnDto.projectId,
      ...result,
    };
    this.socketService.emitToProject('board:columnCreated', payload);
    return result;
  }

  /**
   * 移動欄位到 afterColumnId 後面（null 為最前面），Board 規格 §8.3。
   * 不檢查 boardRevision；afterColumnId 已不在同一專案或已封存時回 409 / ColumnMoveConflict。
   * 回傳專案內所有未封存欄位的最新 position，前端直接照順序重排（Q15）。
   */
  async moveBoardColumn(
    dto: MoveBoardColumnDto,
    userId: string,
  ): Promise<MoveColumnResult> {
    if (dto.afterColumnId === dto.columnId) {
      throw new AppException({
        status: HttpStatus.BAD_REQUEST,
        message: '不能把欄位放在自己後面',
        code: ApiCode.ValidationError,
      });
    }
    const targetColumn = await this.boardRepository.findEditableColumn(
      dto.columnId,
      userId,
    );
    if (targetColumn === null) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到欄位或你沒有存取權限',
        code: ApiCode.ResourceNotFound,
      });
    }
    const projectId = targetColumn.projectId;

    const result = await this.prismaService.$transaction(async (tx) => {
      // 先鎖住專案：後面讀取的 position 都可能被其他人的移動改變。
      const revision = await this.boardRepository.incrementBoardRevision(
        projectId,
        tx,
      );

      // 0 代表「第一欄之前」；實際的 position 一定 >= 1。
      let afterPosition = 0;
      if (dto.afterColumnId !== null) {
        const position = await this.boardRepository.findColumnPositionInProject(
          dto.afterColumnId,
          projectId,
          tx,
        );
        if (position === null) {
          throw new AppException({
            status: HttpStatus.CONFLICT,
            message: '看板已被其他人變更，請重新載入',
            code: ApiCode.ColumnMoveConflict,
          });
        }
        afterPosition = position;
      }

      const position = await this.calculateColumnPosition(
        projectId,
        dto.columnId,
        dto.afterColumnId,
        afterPosition,
        tx,
      );

      const count = await this.boardRepository.moveColumn(
        dto.columnId,
        position,
        tx,
      );
      // 欄位在權限檢查之後被封存；rollback 會讓 revision 維持不變。
      if (count === 0) {
        throw new AppException({
          status: HttpStatus.NOT_FOUND,
          message: '找不到欄位或你沒有存取權限',
          code: ApiCode.ResourceNotFound,
        });
      }

      // 回傳全部欄位的順序：重新編號可能改到其他欄位的 position（Q15）。
      const columns = await this.boardRepository.findColumnPositions(
        projectId,
        tx,
      );
      return { columns, boardRevision: revision.toString() };
    });

    const payload = {
      projectId,
      ...result,
    };
    this.socketService.emitToProject('board:columnMoved', payload);
    return result;
  }

  /**
   * 算出欄位在專案中的新 position（Board 規格 §8.3）；結構與 calculateMovePosition 相同。
   * - afterPosition：前一欄的 position；放在最前面時為 0。
   * - 查下一欄時一律排除正在移動的欄位（它還佔著舊 position）。
   * 位置的三種情況見 positionBetween；相鄰時整個專案的欄位重新編號，再重新查 after 與下一欄的 position 後計算。
   */
  private async calculateColumnPosition(
    projectId: string,
    columnId: string,
    afterColumnId: string | null,
    afterPosition: number,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const nextPosition = await this.boardRepository.findNextColumnPosition(
      projectId,
      afterPosition,
      columnId,
      tx,
    );
    const position = positionBetween(afterPosition, nextPosition);
    if (position !== null) {
      return position;
    }

    // 前後兩欄相鄰（間距 1），重新編排整個專案的欄位 position
    await this.boardRepository.renumberProjectColumns(projectId, columnId, tx);

    let renumberAfterPosition: number | null = 0;
    if (afterColumnId !== null) {
      renumberAfterPosition =
        await this.boardRepository.findColumnPositionInProject(
          afterColumnId,
          projectId,
          tx,
        );
    }
    if (renumberAfterPosition === null) {
      // 正常流程不會發生：after 欄位已在同一個 transaction 中查到、project row 已被鎖住，
      // 且重新編號只改 position。若發生代表程式有 bug，因此丟 500 而不是 409。
      throw new Error('重新編號後找不到 after 欄位');
    }

    const renumberNextPosition =
      await this.boardRepository.findNextColumnPosition(
        projectId,
        renumberAfterPosition,
        columnId,
        tx,
      );

    const renumberedPosition = positionBetween(
      renumberAfterPosition,
      renumberNextPosition,
    );
    if (renumberedPosition === null) {
      // 重新編號後間距是 POSITION_STEP，不可能再相鄰；發生代表程式有 bug。
      throw new Error('重新編號後欄位仍然相鄰');
    }
    return renumberedPosition;
  }
}
