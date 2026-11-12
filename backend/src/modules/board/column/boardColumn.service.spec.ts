import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiCode } from '@kanban/contracts/api';
import { AppException } from '@/common/exceptions/app.exception';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { SocketService } from '@/modules/socket/socket.service';
import { BoardRepository } from '../board.repository';
import { ProjectService } from '@/modules/project/project.service';
import { BoardColumnService } from './boardColumn.service';
import type { MoveBoardColumnDto } from '../dto/moveBoardColumn.dto';

const projectId = 'project-1';
const userId = 'user-1';

describe('BoardColumnService', () => {
  let service: BoardColumnService;
  let findEditableColumn: jest.MockedFunction<
    BoardRepository['findEditableColumn']
  >;
  let incrementBoardRevision: jest.MockedFunction<
    BoardRepository['incrementBoardRevision']
  >;
  let findColumnPositionInProject: jest.MockedFunction<
    BoardRepository['findColumnPositionInProject']
  >;
  let findNextColumnPosition: jest.MockedFunction<
    BoardRepository['findNextColumnPosition']
  >;
  let renumberProjectColumns: jest.MockedFunction<
    BoardRepository['renumberProjectColumns']
  >;
  let moveColumnRecord: jest.MockedFunction<BoardRepository['moveColumn']>;
  let findColumnPositions: jest.MockedFunction<
    BoardRepository['findColumnPositions']
  >;
  let transaction: jest.Mock;
  let emitToProject: jest.Mock;
  let findMembership: jest.Mock;
  let getBoardMaxPosition: jest.Mock;
  let createBoardColumnRecord: jest.Mock;
  // Stand-in for the Prisma transaction client passed to the callback.
  const tx = { isTransaction: true };

  beforeEach(async () => {
    findEditableColumn = jest
      .fn()
      .mockResolvedValue({ id: 'column-1', projectId });
    incrementBoardRevision = jest.fn().mockResolvedValue(13n);
    findColumnPositionInProject = jest.fn().mockResolvedValue(1024);
    findNextColumnPosition = jest.fn().mockResolvedValue(null);
    renumberProjectColumns = jest.fn().mockResolvedValue(undefined);
    moveColumnRecord = jest.fn().mockResolvedValue(1);
    findColumnPositions = jest.fn().mockResolvedValue([
      { id: 'column-2', position: 1024 },
      { id: 'column-1', position: 2048 },
    ]);
    findMembership = jest.fn().mockResolvedValue({
      role: 'EDITOR',
      projectArchivedAt: null,
      workspaceArchivedAt: null,
    });
    getBoardMaxPosition = jest.fn().mockResolvedValue(2048);
    createBoardColumnRecord = jest.fn().mockResolvedValue({
      id: 'column-9',
      projectId,
      title: '待辦',
      colorKey: 'coral',
      position: 3072,
      version: 1,
      archivedAt: null,
      createdAt: new Date('2026-11-07T00:00:00.000Z'),
      updatedAt: new Date('2026-11-07T00:00:00.000Z'),
    });
    emitToProject = jest.fn();
    transaction = jest.fn((callback: (client: unknown) => unknown) =>
      callback(tx),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardColumnService,
        { provide: ProjectService, useValue: { findMembership } },
        {
          provide: BoardRepository,
          useValue: {
            findEditableColumn,
            incrementBoardRevision,
            findColumnPositionInProject,
            findNextColumnPosition,
            renumberProjectColumns,
            moveColumn: moveColumnRecord,
            findColumnPositions,
            getBoardMaxPosition,
            createBoardColumn: createBoardColumnRecord,
          },
        },
        { provide: PrismaService, useValue: { $transaction: transaction } },
        { provide: SocketService, useValue: { emitToProject } },
      ],
    }).compile();

    service = module.get(BoardColumnService);
  });

  describe('moveBoardColumn（D-1，Board 規格 §8.3）', () => {
    const dto: MoveBoardColumnDto = {
      columnId: 'column-1',
      afterColumnId: 'column-2',
    };

    const catchError = async (input: MoveBoardColumnDto) => {
      const error: unknown = await service
        .moveBoardColumn(input, userId)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AppException);
      return error as AppException;
    };

    const movedPosition = () => moveColumnRecord.mock.calls[0]?.[1];

    it('afterColumnId 等於 columnId 時丟 400，不查資料庫', async () => {
      const exception = await catchError({ ...dto, afterColumnId: 'column-1' });

      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(exception.code).toBe(ApiCode.ValidationError);
      expect(findEditableColumn).not.toHaveBeenCalled();
    });

    it('欄位不存在、已封存或沒有編輯權限時丟 404，且不開 transaction', async () => {
      findEditableColumn.mockResolvedValue(null);

      const exception = await catchError(dto);

      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(exception.code).toBe(ApiCode.ResourceNotFound);
      expect(findEditableColumn).toHaveBeenCalledWith('column-1', userId);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('先遞增 revision（鎖住 Project），再查 afterColumnId 的位置', async () => {
      await service.moveBoardColumn(dto, userId);

      expect(incrementBoardRevision).toHaveBeenCalledWith(projectId, tx);
      expect(findColumnPositionInProject).toHaveBeenCalledWith(
        'column-2',
        projectId,
        tx,
      );
      expect(incrementBoardRevision.mock.invocationCallOrder[0]).toBeLessThan(
        findColumnPositionInProject.mock.invocationCallOrder[0],
      );
    });

    it('afterColumnId 已不在專案（被封存、不存在或屬於其他專案）時丟 409 / ColumnMoveConflict，不移動欄位', async () => {
      findColumnPositionInProject.mockResolvedValue(null);

      const exception = await catchError(dto);

      expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(exception.code).toBe(ApiCode.ColumnMoveConflict);
      expect(moveColumnRecord).not.toHaveBeenCalled();
    });

    it('afterColumnId 為 null 時不查 afterColumnId 的位置', async () => {
      await service.moveBoardColumn({ ...dto, afterColumnId: null }, userId);

      expect(findColumnPositionInProject).not.toHaveBeenCalled();
    });

    describe('position 計算', () => {
      it('放在最前面、沒有其他欄位：1024', async () => {
        findNextColumnPosition.mockResolvedValue(null);

        await service.moveBoardColumn({ ...dto, afterColumnId: null }, userId);

        expect(movedPosition()).toBe(1024);
      });

      it('放在最前面、第一欄是 2048：取 0 與 2048 的中間值', async () => {
        findNextColumnPosition.mockResolvedValue(2048);

        await service.moveBoardColumn({ ...dto, afterColumnId: null }, userId);

        expect(movedPosition()).toBe(1024);
      });

      it('放在最後一欄後面：前一欄 + 1024', async () => {
        findColumnPositionInProject.mockResolvedValue(3072);
        findNextColumnPosition.mockResolvedValue(null);

        await service.moveBoardColumn(dto, userId);

        expect(movedPosition()).toBe(4096);
      });

      it('放在兩欄中間：取中間值', async () => {
        findColumnPositionInProject.mockResolvedValue(1024);
        findNextColumnPosition.mockResolvedValue(2048);

        await service.moveBoardColumn(dto, userId);

        expect(movedPosition()).toBe(1536);
      });

      it('找下一欄時排除正在移動的欄位', async () => {
        findColumnPositionInProject.mockResolvedValue(1024);

        await service.moveBoardColumn(dto, userId);

        expect(findNextColumnPosition).toHaveBeenCalledWith(
          projectId,
          1024,
          'column-1',
          tx,
        );
      });

      it('有空間時不重新編號', async () => {
        findColumnPositionInProject.mockResolvedValue(1024);
        findNextColumnPosition.mockResolvedValue(2048);

        await service.moveBoardColumn(dto, userId);

        expect(renumberProjectColumns).not.toHaveBeenCalled();
      });

      it('前後相鄰時先重新編號整個專案的欄位，再用新的位置計算', async () => {
        // Before renumbering: after 1024, next 1025. After: after 2048, next 3072.
        findColumnPositionInProject
          .mockResolvedValueOnce(1024)
          .mockResolvedValue(2048);
        findNextColumnPosition
          .mockResolvedValueOnce(1025)
          .mockResolvedValue(3072);

        await service.moveBoardColumn(dto, userId);

        expect(renumberProjectColumns).toHaveBeenCalledWith(
          projectId,
          'column-1',
          tx,
        );
        expect(renumberProjectColumns.mock.invocationCallOrder[0]).toBeLessThan(
          moveColumnRecord.mock.invocationCallOrder[0],
        );
        // after 欄位的位置在重新編號後重新查詢，並用新的位置找下一欄
        expect(findColumnPositionInProject).toHaveBeenCalledTimes(2);
        expect(findNextColumnPosition).toHaveBeenLastCalledWith(
          projectId,
          2048,
          'column-1',
          tx,
        );
        expect(movedPosition()).toBe(2560);
      });

      it('放在最前面但第一欄是 1：重新編號後放在 0 與 1024 之間', async () => {
        findNextColumnPosition.mockResolvedValueOnce(1).mockResolvedValue(1024);

        await service.moveBoardColumn({ ...dto, afterColumnId: null }, userId);

        expect(renumberProjectColumns).toHaveBeenCalledTimes(1);
        expect(findColumnPositionInProject).not.toHaveBeenCalled();
        expect(movedPosition()).toBe(512);
      });

      it('重新編號後找不到 after 欄位時丟一般 Error（500），不是 409', async () => {
        findColumnPositionInProject
          .mockResolvedValueOnce(1024)
          .mockResolvedValue(null);
        findNextColumnPosition.mockResolvedValue(1025);

        const error: unknown = await service
          .moveBoardColumn(dto, userId)
          .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(AppException);
        expect(moveColumnRecord).not.toHaveBeenCalled();
      });
    });

    it('移動成功：寫入後回傳全部欄位的順序與 boardRevision（Q15）', async () => {
      findColumnPositionInProject.mockResolvedValue(1024);
      findNextColumnPosition.mockResolvedValue(2048);
      findColumnPositions.mockResolvedValue([
        { id: 'column-2', position: 1024 },
        { id: 'column-1', position: 1536 },
        { id: 'column-3', position: 2048 },
      ]);

      const result = await service.moveBoardColumn(dto, userId);

      expect(moveColumnRecord).toHaveBeenCalledWith('column-1', 1536, tx);
      expect(findColumnPositions).toHaveBeenCalledWith(projectId, tx);
      // Read after the write so the response includes this move (and any renumbering).
      expect(moveColumnRecord.mock.invocationCallOrder[0]).toBeLessThan(
        findColumnPositions.mock.invocationCallOrder[0],
      );
      expect(result).toEqual({
        columns: [
          { id: 'column-2', position: 1024 },
          { id: 'column-1', position: 1536 },
          { id: 'column-3', position: 2048 },
        ],
        boardRevision: '13',
      });
    });

    it('欄位在檢查後被封存（移動 0 筆）時丟 404，不查欄位順序', async () => {
      moveColumnRecord.mockResolvedValue(0);

      const exception = await catchError(dto);

      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(exception.code).toBe(ApiCode.ResourceNotFound);
      expect(findColumnPositions).not.toHaveBeenCalled();
    });
  });

  describe('廣播（C-2，Board 規格 §7.2）', () => {
    /** emit 必須在 transaction 回傳（commit）之後。 */
    const expectEmittedAfterCommit = () => {
      expect(transaction.mock.invocationCallOrder[0]).toBeLessThan(
        emitToProject.mock.invocationCallOrder[0],
      );
    };

    it('createBoardColumn：回傳 AddColumnResult（只有 4 個欄位與空 cards），並廣播 board:columnCreated', async () => {
      const result = await service.createBoardColumn(
        { projectId, title: '待辦', colorKey: 'coral' },
        userId,
      );

      expect(result).toEqual({
        column: {
          id: 'column-9',
          title: '待辦',
          colorKey: 'coral',
          position: 3072,
          cards: [],
        },
        boardRevision: '13',
      });
      expect(emitToProject).toHaveBeenCalledTimes(1);
      expect(emitToProject).toHaveBeenCalledWith('board:columnCreated', {
        ...result,
        projectId,
      });
      expectEmittedAfterCommit();
    });

    it('moveBoardColumn：廣播 board:columnMoved（D-1）', async () => {
      const result = await service.moveBoardColumn(
        { columnId: 'column-1', afterColumnId: null },
        userId,
      );

      expect(emitToProject).toHaveBeenCalledTimes(1);
      expect(emitToProject).toHaveBeenCalledWith('board:columnMoved', {
        ...result,
        projectId,
      });
      expectEmittedAfterCommit();
    });

    it('moveBoardColumn 衝突（409）時不廣播', async () => {
      findColumnPositionInProject.mockResolvedValue(null);

      await service
        .moveBoardColumn(
          { columnId: 'column-1', afterColumnId: 'column-2' },
          userId,
        )
        .catch(() => undefined);

      expect(emitToProject).not.toHaveBeenCalled();
    });
  });
});
