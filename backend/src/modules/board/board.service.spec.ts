import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiCode } from '@kanban/contracts/api';
import { AppException } from '@/common/exceptions/app.exception';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { SocketService } from '@/modules/socket/socket.service';
import { BoardRepository } from './board.repository';
import { BoardService } from './board.service';

type BoardRecord = NonNullable<
  Awaited<ReturnType<BoardRepository['getAllBoardColumn']>>
>;
type ColumnRecord = BoardRecord['boardColumns'][number];
type CardRecord = ColumnRecord['cards'][number];

const projectId = 'project-1';
const CATEGORY_ID = 'category-1';
const userId = 'user-1';
const createdAt = new Date('2026-11-01T08:00:00.000Z');
const updatedAt = new Date('2026-11-02T09:30:00.000Z');

const createCard = (overrides: Partial<CardRecord> = {}): CardRecord => ({
  id: 'card-1',
  columnId: 'column-1',
  title: '建立看板 API',
  description: null,
  categoryId: null,
  position: 1024,
  version: 1,
  createdAt,
  updatedAt,
  ...overrides,
});

const createColumn = (overrides: Partial<ColumnRecord> = {}): ColumnRecord => ({
  id: 'column-1',
  title: '待處理',
  colorKey: 'coral',
  position: 1024,
  version: 1,
  cards: [],
  ...overrides,
});

describe('BoardService', () => {
  let service: BoardService;
  let getAllBoardColumn: jest.MockedFunction<
    BoardRepository['getAllBoardColumn']
  >;
  let transaction: jest.Mock;
  let emitToProject: jest.Mock;
  // Stand-in for the Prisma transaction client passed to the callback.
  const tx = { isTransaction: true };

  beforeEach(async () => {
    getAllBoardColumn = jest.fn();
    emitToProject = jest.fn();
    transaction = jest.fn((callback: (client: unknown) => unknown) =>
      callback(tx),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardService,
        {
          provide: BoardRepository,
          useValue: {
            getAllBoardColumn,
          },
        },
        { provide: PrismaService, useValue: { $transaction: transaction } },
        { provide: SocketService, useValue: { emitToProject } },
      ],
    }).compile();

    service = module.get(BoardService);
  });

  describe('getBoardColumn', () => {
    it('以 projectId 與 userId 查詢，並轉成 BoardSnapshot', async () => {
      getAllBoardColumn.mockResolvedValue({
        boardRevision: 12n,
        cardCategories: [],
        members: [{ role: 'EDITOR' }],
        boardColumns: [
          createColumn({
            cards: [
              createCard(),
              createCard({ id: 'card-2', position: 2048, description: '描述' }),
            ],
          }),
          createColumn({ id: 'column-2', title: '進行中', position: 2048 }),
        ],
      });

      const snapshot = await service.getBoardColumn(projectId, userId);

      expect(getAllBoardColumn).toHaveBeenCalledWith(projectId, userId);
      expect(snapshot).toEqual({
        boardRevision: '12',
        currentUserRole: 'EDITOR',
        categories: [],
        columns: [
          {
            id: 'column-1',
            title: '待處理',
            colorKey: 'coral',
            position: 1024,
            cards: [
              {
                id: 'card-1',
                columnId: 'column-1',
                title: '建立看板 API',
                description: null,
                categoryId: null,
                position: 1024,
                version: 1,
                createdAt: '2026-11-01T08:00:00.000Z',
                updatedAt: '2026-11-02T09:30:00.000Z',
              },
              expect.objectContaining({ id: 'card-2', description: '描述' }),
            ],
          },
          {
            id: 'column-2',
            title: '進行中',
            colorKey: 'coral',
            position: 2048,
            cards: [],
          },
        ],
      });
    });

    it('回傳內容可被 JSON 序列化（BigInt 已轉為字串）', async () => {
      getAllBoardColumn.mockResolvedValue({
        boardRevision: 9007199254740993n, // beyond Number.MAX_SAFE_INTEGER
        cardCategories: [],
        members: [{ role: 'EDITOR' }],
        boardColumns: [createColumn({ cards: [createCard()] })],
      });

      const snapshot = await service.getBoardColumn(projectId, userId);

      expect(() => JSON.stringify(snapshot)).not.toThrow();
      expect(snapshot.boardRevision).toBe('9007199254740993');
    });

    it('回傳目前使用者在專案的角色', async () => {
      getAllBoardColumn.mockResolvedValue({
        boardRevision: 1n,
        cardCategories: [],
        members: [{ role: 'VIEWER' }],
        boardColumns: [],
      });

      const snapshot = await service.getBoardColumn(projectId, userId);

      expect(snapshot.currentUserRole).toBe('VIEWER');
    });

    it('不公開欄位的 version 等內部欄位', async () => {
      getAllBoardColumn.mockResolvedValue({
        boardRevision: 0n,
        cardCategories: [],
        members: [{ role: 'EDITOR' }],
        boardColumns: [createColumn()],
      });

      const snapshot = await service.getBoardColumn(projectId, userId);

      expect(Object.keys(snapshot.columns[0]).sort()).toEqual([
        'cards',
        'colorKey',
        'id',
        'position',
        'title',
      ]);
    });

    it('成員但所有欄位都已封存時回傳空的 columns，不視為沒有權限', async () => {
      getAllBoardColumn.mockResolvedValue({
        boardRevision: 3n,
        cardCategories: [],
        members: [{ role: 'EDITOR' }],
        boardColumns: [],
      });

      await expect(service.getBoardColumn(projectId, userId)).resolves.toEqual({
        boardRevision: '3',
        currentUserRole: 'EDITOR',
        categories: [],
        columns: [],
      });
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

  describe('卡片類別（A+1-3）', () => {
    it('看板回傳專案的類別清單（只有 id、name、colorKey）與卡片的 categoryId', async () => {
      getAllBoardColumn.mockResolvedValue({
        boardRevision: 5n,
        cardCategories: [
          { id: 'category-2', name: '前端', colorKey: 'lavender' },
          { id: CATEGORY_ID, name: '後端', colorKey: 'mint' },
        ],
        members: [{ role: 'EDITOR' }],
        boardColumns: [
          createColumn({ cards: [createCard({ categoryId: CATEGORY_ID })] }),
        ],
      });

      const snapshot = await service.getBoardColumn(projectId, userId);

      expect(snapshot.categories).toEqual([
        { id: 'category-2', name: '前端', colorKey: 'lavender' },
        { id: CATEGORY_ID, name: '後端', colorKey: 'mint' },
      ]);
      expect(snapshot.columns[0].cards[0].categoryId).toBe(CATEGORY_ID);
    });
  });
});
