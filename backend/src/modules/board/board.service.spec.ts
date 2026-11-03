import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiCode } from '@kanban/contracts/api';
import { AppException } from '@/common/exceptions/app.exception';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { ProjectService } from '@/modules/project/project.service';
import { BoardRepository } from './board.repository';
import { BoardService } from './board.service';
import type { AddCardDto } from './dto/addCard.dto';
import type { UpdateCardDto } from './dto/updateCard.dto';

type BoardRecord = NonNullable<
  Awaited<ReturnType<BoardRepository['getAllBoardColumn']>>
>;
type ColumnRecord = BoardRecord['boardColumns'][number];
type CardRecord = ColumnRecord['cards'][number];

const projectId = 'project-1';
const userId = 'user-1';
const createdAt = new Date('2026-11-01T08:00:00.000Z');
const updatedAt = new Date('2026-11-02T09:30:00.000Z');

const createCard = (overrides: Partial<CardRecord> = {}): CardRecord => ({
  id: 'card-1',
  columnId: 'column-1',
  title: '建立看板 API',
  description: null,
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
  let findEditableColumn: jest.MockedFunction<
    BoardRepository['findEditableColumn']
  >;
  let incrementBoardRevision: jest.MockedFunction<
    BoardRepository['incrementBoardRevision']
  >;
  let getCardMaxPosition: jest.MockedFunction<
    BoardRepository['getCardMaxPosition']
  >;
  let createCardRecord: jest.MockedFunction<BoardRepository['createCard']>;
  let findEditableCard: jest.MockedFunction<
    BoardRepository['findEditableCard']
  >;
  let updateCardContent: jest.MockedFunction<
    BoardRepository['updateCardContent']
  >;
  let findCardSnapshot: jest.MockedFunction<
    BoardRepository['findCardSnapshot']
  >;
  let transaction: jest.Mock;
  // Stand-in for the Prisma transaction client passed to the callback.
  const tx = { isTransaction: true };

  beforeEach(async () => {
    getAllBoardColumn = jest.fn();
    findEditableColumn = jest
      .fn()
      .mockResolvedValue({ id: 'column-1', projectId });
    incrementBoardRevision = jest.fn().mockResolvedValue(13n);
    getCardMaxPosition = jest.fn().mockResolvedValue(2048);
    createCardRecord = jest.fn().mockResolvedValue(createCard());
    findEditableCard = jest
      .fn()
      .mockResolvedValue({ id: 'card-1', column: { projectId } });
    updateCardContent = jest.fn().mockResolvedValue(1);
    findCardSnapshot = jest
      .fn()
      .mockResolvedValue(createCard({ title: '新標題', version: 4 }));
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
            findEditableColumn,
            incrementBoardRevision,
            getCardMaxPosition,
            createCard: createCardRecord,
            findEditableCard,
            updateCardContent,
            findCardSnapshot,
          },
        },
        { provide: ProjectService, useValue: {} },
        { provide: PrismaService, useValue: { $transaction: transaction } },
      ],
    }).compile();

    service = module.get(BoardService);
  });

  describe('getBoardColumn', () => {
    it('以 projectId 與 userId 查詢，並轉成 BoardSnapshot', async () => {
      getAllBoardColumn.mockResolvedValue({
        boardRevision: 12n,
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
        boardColumns: [createColumn({ cards: [createCard()] })],
      });

      const snapshot = await service.getBoardColumn(projectId, userId);

      expect(() => JSON.stringify(snapshot)).not.toThrow();
      expect(snapshot.boardRevision).toBe('9007199254740993');
    });

    it('不公開欄位的 version 等內部欄位', async () => {
      getAllBoardColumn.mockResolvedValue({
        boardRevision: 0n,
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
        boardColumns: [],
      });

      await expect(service.getBoardColumn(projectId, userId)).resolves.toEqual({
        boardRevision: '3',
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
  describe('createCard', () => {
    const dto: AddCardDto = {
      columnId: 'column-1',
      title: '建立看板 API',
      description: '先完成新增卡片',
    };

    it('在 transaction 內遞增 revision、放到欄位最下面，並回傳 CardMutationResult', async () => {
      const result = await service.createCard(dto, userId);

      expect(findEditableColumn).toHaveBeenCalledWith('column-1', userId);
      expect(incrementBoardRevision).toHaveBeenCalledWith(projectId, tx);
      expect(getCardMaxPosition).toHaveBeenCalledWith('column-1', tx);
      expect(createCardRecord).toHaveBeenCalledWith(
        {
          columnId: 'column-1',
          title: '建立看板 API',
          description: '先完成新增卡片',
          userId,
          position: 2048 + 1024,
        },
        tx,
      );
      expect(result).toEqual({
        boardRevision: '13',
        card: {
          id: 'card-1',
          columnId: 'column-1',
          title: '建立看板 API',
          description: null,
          position: 1024,
          version: 1,
          createdAt: '2026-11-01T08:00:00.000Z',
          updatedAt: '2026-11-02T09:30:00.000Z',
        },
      });
    });

    it('先遞增 revision（鎖住 Project）再查最大 position，避免同時新增時 position 重複', async () => {
      await service.createCard(dto, userId);

      expect(incrementBoardRevision.mock.invocationCallOrder[0]).toBeLessThan(
        getCardMaxPosition.mock.invocationCallOrder[0],
      );
    });

    it('空欄位的第一張卡片 position 為 1024', async () => {
      getCardMaxPosition.mockResolvedValue(null);

      await service.createCard(dto, userId);

      expect(createCardRecord).toHaveBeenCalledWith(
        expect.objectContaining({ position: 1024 }),
        tx,
      );
    });

    it.each([
      ['省略', undefined],
      ['只有空白（trim 後為空字串）', ''],
    ])('描述%s時存成 null', async (_label, description) => {
      await service.createCard({ ...dto, description }, userId);

      expect(createCardRecord).toHaveBeenCalledWith(
        expect.objectContaining({ description: null }),
        tx,
      );
    });

    it('沒有編輯權限（非成員、VIEWER、欄位或 Project 已封存）時丟 404，且不開 transaction', async () => {
      findEditableColumn.mockResolvedValue(null);

      const error: unknown = await service
        .createCard(dto, userId)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AppException);
      const exception = error as AppException;
      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(exception.code).toBe(ApiCode.ResourceNotFound);
      expect(transaction).not.toHaveBeenCalled();
      expect(createCardRecord).not.toHaveBeenCalled();
    });
  });
  describe('updateCard', () => {
    const dto: UpdateCardDto = {
      cardId: 'card-1',
      title: '新標題',
      expectedVersion: 3,
    };

    const catchUpdateError = async (input: UpdateCardDto) => {
      const error: unknown = await service
        .updateCard(input, userId)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AppException);
      return error as AppException;
    };

    it('在 transaction 內遞增 revision、帶版本更新，並回傳最新卡片', async () => {
      const result = await service.updateCard(dto, userId);

      expect(findEditableCard).toHaveBeenCalledWith('card-1', userId);
      expect(incrementBoardRevision).toHaveBeenCalledWith(projectId, tx);
      expect(updateCardContent).toHaveBeenCalledWith(
        'card-1',
        3,
        { title: '新標題', description: undefined },
        tx,
      );
      expect(findCardSnapshot).toHaveBeenCalledWith('card-1', tx);
      expect(result.boardRevision).toBe('13');
      expect(result.card).toEqual(
        expect.objectContaining({
          title: '新標題',
          version: 4,
          updatedAt: '2026-11-02T09:30:00.000Z',
        }),
      );
    });

    it('先遞增 revision（鎖住 Project）再更新卡片', async () => {
      await service.updateCard(dto, userId);

      expect(incrementBoardRevision.mock.invocationCallOrder[0]).toBeLessThan(
        updateCardContent.mock.invocationCallOrder[0],
      );
    });

    it.each([
      ['沒送描述：不改（undefined）', undefined, undefined],
      ['空字串：清空（null）', '', null],
      ['有內容：更新', '新描述', '新描述'],
    ])('描述%s', async (_label, description, expected) => {
      await service.updateCard({ ...dto, description }, userId);

      expect(updateCardContent).toHaveBeenCalledWith(
        'card-1',
        3,
        expect.objectContaining({ description: expected }),
        tx,
      );
    });

    it('版本不符（更新 0 筆）時丟 409 / CardVersionConflict，不查卡片', async () => {
      updateCardContent.mockResolvedValue(0);

      const exception = await catchUpdateError(dto);

      expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(exception.code).toBe(ApiCode.CardVersionConflict);
      expect(findCardSnapshot).not.toHaveBeenCalled();
    });

    it('標題與描述都沒送時丟 400，且不查權限也不開 transaction', async () => {
      const exception = await catchUpdateError({
        cardId: 'card-1',
        expectedVersion: 3,
      });

      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(exception.code).toBe(ApiCode.ValidationError);
      expect(findEditableCard).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    });

    it('沒有編輯權限時丟 404，且不開 transaction', async () => {
      findEditableCard.mockResolvedValue(null);

      const exception = await catchUpdateError(dto);

      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(exception.code).toBe(ApiCode.ResourceNotFound);
      expect(transaction).not.toHaveBeenCalled();
    });
  });
});
