import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiCode } from '@kanban/contracts/api';
import { AppException } from '@/common/exceptions/app.exception';
import type { BoardColumn } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { ProjectService } from '@/modules/project/project.service';
import { BoardRepository } from './board.repository';
import { BoardService } from './board.service';

const projectId = 'project-1';
const userId = 'user-1';

const createColumn = (overrides: Partial<BoardColumn> = {}): BoardColumn => ({
  id: 'column-1',
  projectId,
  title: '待處理',
  colorKey: 'todo',
  position: 1024,
  version: 1,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('BoardService', () => {
  let service: BoardService;
  let getAllBoardColumn: jest.MockedFunction<
    BoardRepository['getAllBoardColumn']
  >;

  beforeEach(async () => {
    getAllBoardColumn = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardService,
        { provide: BoardRepository, useValue: { getAllBoardColumn } },
        { provide: ProjectService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get(BoardService);
  });

  describe('getBoardColumn', () => {
    it('以 projectId 與 userId 查詢，成員可取得欄位', async () => {
      const columns = [
        createColumn(),
        createColumn({ id: 'column-2', position: 2048 }),
      ];
      getAllBoardColumn.mockResolvedValue(columns);

      await expect(service.getBoardColumn(projectId, userId)).resolves.toBe(
        columns,
      );
      expect(getAllBoardColumn).toHaveBeenCalledWith(projectId, userId);
    });

    it('成員但所有欄位都已封存時回傳空陣列，不視為沒有權限', async () => {
      getAllBoardColumn.mockResolvedValue([]);

      await expect(service.getBoardColumn(projectId, userId)).resolves.toEqual(
        [],
      );
    });

    it('非成員或 Project／Workspace 已封存時丟 404 / ResourceNotFound', async () => {
      getAllBoardColumn.mockResolvedValue(null);

      const error: unknown = await service
        .getBoardColumn(projectId, userId)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AppException);
      const exception = error as AppException;
      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(exception.code).toBe(ApiCode.ResourceNotFound);
    });
  });
});
