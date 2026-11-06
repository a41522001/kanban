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
import type { ArchiveCardDto } from './dto/archiveCard.dto';
import type { AddCategoryDto } from './dto/addCategory.dto';
import type { MoveCardDto } from './dto/moveCard.dto';

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
  let archiveCardRecord: jest.MockedFunction<BoardRepository['archiveCard']>;
  let findEditableProject: jest.MockedFunction<
    BoardRepository['findEditableProject']
  >;
  let findCategoryByNormalizedName: jest.MockedFunction<
    BoardRepository['findCategoryByNormalizedName']
  >;
  let getBoardRevision: jest.MockedFunction<
    BoardRepository['getBoardRevision']
  >;
  let countCategories: jest.MockedFunction<BoardRepository['countCategories']>;
  let createCategoryRecord: jest.MockedFunction<
    BoardRepository['createCategory']
  >;
  let findCategoryInProject: jest.MockedFunction<
    BoardRepository['findCategoryInProject']
  >;
  let findCardPositionInColumn: jest.MockedFunction<
    BoardRepository['findCardPositionInColumn']
  >;
  let findNextCardPosition: jest.MockedFunction<
    BoardRepository['findNextCardPosition']
  >;
  let moveCardRecord: jest.MockedFunction<BoardRepository['moveCard']>;
  let renumberColumnCards: jest.MockedFunction<
    BoardRepository['renumberColumnCards']
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
    findEditableCard = jest.fn().mockResolvedValue({
      id: 'card-1',
      columnId: 'column-1',
      column: { projectId },
    });
    updateCardContent = jest.fn().mockResolvedValue(1);
    archiveCardRecord = jest.fn().mockResolvedValue(1);
    findCardSnapshot = jest
      .fn()
      .mockResolvedValue(createCard({ title: '新標題', version: 4 }));
    findEditableProject = jest.fn().mockResolvedValue({ id: projectId });
    findCategoryByNormalizedName = jest.fn().mockResolvedValue(null);
    getBoardRevision = jest.fn().mockResolvedValue(12n);
    countCategories = jest.fn().mockResolvedValue(3);
    createCategoryRecord = jest.fn().mockResolvedValue({
      id: 'category-1',
      name: 'Backend',
      colorKey: 'mint',
    });
    findCategoryInProject = jest.fn().mockResolvedValue({ id: CATEGORY_ID });
    findCardPositionInColumn = jest.fn().mockResolvedValue(1024);
    findNextCardPosition = jest.fn().mockResolvedValue(null);
    moveCardRecord = jest.fn().mockResolvedValue(1);
    renumberColumnCards = jest.fn().mockResolvedValue(undefined);
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
            archiveCard: archiveCardRecord,
            findEditableProject,
            findCategoryByNormalizedName,
            getBoardRevision,
            countCategories,
            createCategory: createCategoryRecord,
            findCategoryInProject,
            findCardPositionInColumn,
            findNextCardPosition,
            moveCard: moveCardRecord,
            renumberColumnCards,
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
          categoryId: null,
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
          categoryId: null,
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
  describe('archiveCard', () => {
    const dto: ArchiveCardDto = { cardId: 'card-1', expectedVersion: 3 };

    it('在 transaction 內遞增 revision、帶版本封存，回傳 cardId、columnId 與 boardRevision', async () => {
      const result = await service.archiveCard(dto, userId);

      expect(findEditableCard).toHaveBeenCalledWith('card-1', userId);
      expect(incrementBoardRevision).toHaveBeenCalledWith(projectId, tx);
      expect(archiveCardRecord).toHaveBeenCalledWith('card-1', 3, tx);
      expect(result).toEqual({
        cardId: 'card-1',
        columnId: 'column-1',
        boardRevision: '13',
      });
    });

    it('先遞增 revision（鎖住 Project）再封存卡片', async () => {
      await service.archiveCard(dto, userId);

      expect(incrementBoardRevision.mock.invocationCallOrder[0]).toBeLessThan(
        archiveCardRecord.mock.invocationCallOrder[0],
      );
    });

    it('版本不符（封存 0 筆）時丟 409 / CardVersionConflict', async () => {
      archiveCardRecord.mockResolvedValue(0);

      const error: unknown = await service
        .archiveCard(dto, userId)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AppException);
      const exception = error as AppException;
      expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(exception.code).toBe(ApiCode.CardVersionConflict);
    });

    it('沒有編輯權限時丟 404，且不開 transaction', async () => {
      findEditableCard.mockResolvedValue(null);

      const error: unknown = await service
        .archiveCard(dto, userId)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(transaction).not.toHaveBeenCalled();
      expect(archiveCardRecord).not.toHaveBeenCalled();
    });
  });

  describe('addCategory', () => {
    const dto: AddCategoryDto = {
      projectId,
      name: 'Backend',
      colorKey: 'mint',
    };

    it('新名稱：遞增 revision、檢查上限後建立，normalizedName 為小寫', async () => {
      const result = await service.addCategory(dto, userId);

      expect(findEditableProject).toHaveBeenCalledWith(projectId, userId);
      expect(findCategoryByNormalizedName).toHaveBeenCalledWith(
        projectId,
        'backend',
        tx,
      );
      expect(incrementBoardRevision).toHaveBeenCalledWith(projectId, tx);
      expect(countCategories).toHaveBeenCalledWith(projectId, tx);
      expect(createCategoryRecord).toHaveBeenCalledWith(
        {
          projectId,
          name: 'Backend',
          normalizedName: 'backend',
          colorKey: 'mint',
        },
        tx,
      );
      expect(result).toEqual({
        category: { id: 'category-1', name: 'Backend', colorKey: 'mint' },
        boardRevision: '13',
      });
    });

    it('先遞增 revision（鎖住 Project）再數類別數量', async () => {
      await service.addCategory(dto, userId);

      expect(incrementBoardRevision.mock.invocationCallOrder[0]).toBeLessThan(
        countCategories.mock.invocationCallOrder[0],
      );
    });

    it('名稱已存在（不分大小寫）時沿用既有類別，revision 不變也不檢查上限', async () => {
      findCategoryByNormalizedName.mockResolvedValue({
        id: 'category-9',
        name: 'backend',
        colorKey: 'teal',
      });

      const result = await service.addCategory(dto, userId);

      expect(result).toEqual({
        category: { id: 'category-9', name: 'backend', colorKey: 'teal' },
        boardRevision: '12',
      });
      expect(getBoardRevision).toHaveBeenCalledWith(projectId, tx);
      expect(incrementBoardRevision).not.toHaveBeenCalled();
      expect(countCategories).not.toHaveBeenCalled();
      expect(createCategoryRecord).not.toHaveBeenCalled();
    });

    it('已達 50 個時丟 409 / CardCategoryLimitExceeded，且不建立', async () => {
      countCategories.mockResolvedValue(50);

      const error: unknown = await service
        .addCategory(dto, userId)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AppException);
      const exception = error as AppException;
      expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(exception.code).toBe(ApiCode.CardCategoryLimitExceeded);
      expect(createCategoryRecord).not.toHaveBeenCalled();
    });

    it('49 個時仍可建立第 50 個', async () => {
      countCategories.mockResolvedValue(49);

      await service.addCategory(dto, userId);

      expect(createCategoryRecord).toHaveBeenCalled();
    });

    it('沒有編輯權限時丟 404，且不開 transaction', async () => {
      findEditableProject.mockResolvedValue(null);

      const error: unknown = await service
        .addCategory(dto, userId)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AppException);
      const exception = error as AppException;
      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(exception.code).toBe(ApiCode.ResourceNotFound);
      expect(transaction).not.toHaveBeenCalled();
    });
  });

  describe('卡片類別（A+1-3）', () => {
    const expect404WithoutTransaction = async (promise: Promise<unknown>) => {
      const error: unknown = await promise.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AppException);
      const exception = error as AppException;
      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(exception.code).toBe(ApiCode.ResourceNotFound);
      expect(transaction).not.toHaveBeenCalled();
    };

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

    it('新增卡片帶類別：確認類別屬於同一專案後寫入 categoryId', async () => {
      const dto: AddCardDto = {
        columnId: 'column-1',
        title: '標題',
        categoryId: CATEGORY_ID,
      };

      await service.createCard(dto, userId);

      expect(findCategoryInProject).toHaveBeenCalledWith(
        CATEGORY_ID,
        projectId,
      );
      expect(createCardRecord).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: CATEGORY_ID }),
        tx,
      );
    });

    it('新增卡片沒帶類別時不查類別，categoryId 存成 null', async () => {
      await service.createCard({ columnId: 'column-1', title: '標題' }, userId);

      expect(findCategoryInProject).not.toHaveBeenCalled();
      expect(createCardRecord).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: null }),
        tx,
      );
    });

    it('新增卡片的類別屬於別的專案（或不存在）時丟 404，且不開 transaction', async () => {
      findCategoryInProject.mockResolvedValue(null);

      await expect404WithoutTransaction(
        service.createCard(
          { columnId: 'column-1', title: '標題', categoryId: CATEGORY_ID },
          userId,
        ),
      );
      expect(createCardRecord).not.toHaveBeenCalled();
    });

    it('編輯時只送 categoryId 也算有修改，不回 400', async () => {
      const dto: UpdateCardDto = {
        cardId: 'card-1',
        categoryId: CATEGORY_ID,
        expectedVersion: 3,
      };

      await service.updateCard(dto, userId);

      expect(findCategoryInProject).toHaveBeenCalledWith(
        CATEGORY_ID,
        projectId,
      );
      expect(updateCardContent).toHaveBeenCalledWith(
        'card-1',
        3,
        expect.objectContaining({ categoryId: CATEGORY_ID }),
        tx,
      );
    });

    it('編輯時 categoryId 為 null 代表移除類別，不需要查類別', async () => {
      await service.updateCard(
        { cardId: 'card-1', categoryId: null, expectedVersion: 3 },
        userId,
      );

      expect(findCategoryInProject).not.toHaveBeenCalled();
      expect(updateCardContent).toHaveBeenCalledWith(
        'card-1',
        3,
        expect.objectContaining({ categoryId: null }),
        tx,
      );
    });

    it('編輯時沒送 categoryId 代表不改', async () => {
      await service.updateCard(
        { cardId: 'card-1', title: '新標題', expectedVersion: 3 },
        userId,
      );

      const data = updateCardContent.mock.calls[0][2];
      expect(data.categoryId).toBeUndefined();
    });

    it('編輯時類別屬於別的專案時丟 404，且不開 transaction', async () => {
      findCategoryInProject.mockResolvedValue(null);

      await expect404WithoutTransaction(
        service.updateCard(
          { cardId: 'card-1', categoryId: CATEGORY_ID, expectedVersion: 3 },
          userId,
        ),
      );
      expect(updateCardContent).not.toHaveBeenCalled();
    });
  });

  describe('moveCard（B-1）', () => {
    const dto: MoveCardDto = {
      cardId: 'card-1',
      toColumnId: 'column-2',
      afterCardId: 'card-2',
    };

    beforeEach(() => {
      findEditableColumn.mockResolvedValue({ id: 'column-2', projectId });
    });

    const catchError = async (input: MoveCardDto) => {
      const error: unknown = await service
        .moveCard(input, userId)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AppException);
      return error as AppException;
    };

    it('afterCardId 等於 cardId 時丟 400，不查資料庫', async () => {
      const exception = await catchError({ ...dto, afterCardId: 'card-1' });

      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(exception.code).toBe(ApiCode.ValidationError);
      expect(findEditableCard).not.toHaveBeenCalled();
    });

    it('沒有卡片的編輯權限時丟 404，且不開 transaction', async () => {
      findEditableCard.mockResolvedValue(null);

      const exception = await catchError(dto);

      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('目標欄位不存在、已封存或沒有權限時丟 404', async () => {
      findEditableColumn.mockResolvedValue(null);

      const exception = await catchError(dto);

      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(findEditableColumn).toHaveBeenCalledWith('column-2', userId);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('目標欄位屬於其他專案時丟 404', async () => {
      findEditableColumn.mockResolvedValue({
        id: 'column-2',
        projectId: 'project-2',
      });

      const exception = await catchError(dto);

      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('先遞增 revision（鎖住 Project），再查 afterCardId 的位置', async () => {
      await service.moveCard(dto, userId).catch(() => undefined);

      expect(incrementBoardRevision).toHaveBeenCalledWith(projectId, tx);
      expect(findCardPositionInColumn).toHaveBeenCalledWith(
        'card-2',
        'column-2',
        tx,
      );
      expect(incrementBoardRevision.mock.invocationCallOrder[0]).toBeLessThan(
        findCardPositionInColumn.mock.invocationCallOrder[0],
      );
    });

    it('afterCardId 已不在目標欄位時丟 409 / CardMoveConflict，不移動卡片', async () => {
      findCardPositionInColumn.mockResolvedValue(null);

      const exception = await catchError(dto);

      expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(exception.code).toBe(ApiCode.CardMoveConflict);
      expect(moveCardRecord).not.toHaveBeenCalled();
    });

    it('afterCardId 為 null 時不查 afterCardId 的位置', async () => {
      await service
        .moveCard({ ...dto, afterCardId: null }, userId)
        .catch(() => undefined);

      expect(findCardPositionInColumn).not.toHaveBeenCalled();
    });

    describe('position 計算（使用者練習）', () => {
      const movedPosition = () => moveCardRecord.mock.calls[0]?.[2];

      it('移到空欄位的最上面：1024', async () => {
        findNextCardPosition.mockResolvedValue(null);

        await service.moveCard({ ...dto, afterCardId: null }, userId);

        expect(movedPosition()).toBe(1024);
      });

      it('放在最後一張後面：前一張 + 1024', async () => {
        findCardPositionInColumn.mockResolvedValue(3072);
        findNextCardPosition.mockResolvedValue(null);

        await service.moveCard(dto, userId);

        expect(movedPosition()).toBe(4096);
      });

      it('放在兩張中間：取中間值', async () => {
        findCardPositionInColumn.mockResolvedValue(1024);
        findNextCardPosition.mockResolvedValue(2048);

        await service.moveCard(dto, userId);

        expect(movedPosition()).toBe(1536);
      });

      it('放在最上面、第一張是 2048：取 0 與 2048 的中間值', async () => {
        findNextCardPosition.mockResolvedValue(2048);

        await service.moveCard({ ...dto, afterCardId: null }, userId);

        expect(movedPosition()).toBe(1024);
      });

      it('中間值不是整數時取兩者之間的整數', async () => {
        findCardPositionInColumn.mockResolvedValue(1024);
        findNextCardPosition.mockResolvedValue(1027);

        await service.moveCard(dto, userId);

        const position = movedPosition();
        expect(Number.isInteger(position)).toBe(true);
        expect(position).toBeGreaterThan(1024);
        expect(position).toBeLessThan(1027);
      });

      it('找下一張時排除正在移動的卡片', async () => {
        findCardPositionInColumn.mockResolvedValue(1024);

        await service.moveCard(dto, userId);

        expect(findNextCardPosition).toHaveBeenCalledWith(
          'column-2',
          1024,
          'card-1',
          tx,
        );
      });

      it('前後相鄰時先重新編號，再用新的位置計算', async () => {
        // Before renumbering: after 1024, next 1025. After: after 2048, next 3072.
        findCardPositionInColumn
          .mockResolvedValueOnce(1024)
          .mockResolvedValue(2048);
        findNextCardPosition
          .mockResolvedValueOnce(1025)
          .mockResolvedValue(3072);

        await service.moveCard(dto, userId);

        expect(renumberColumnCards).toHaveBeenCalledWith(
          'column-2',
          'card-1',
          tx,
        );
        expect(renumberColumnCards.mock.invocationCallOrder[0]).toBeLessThan(
          moveCardRecord.mock.invocationCallOrder[0],
        );
        expect(movedPosition()).toBe(2560);
      });

      it('放在最上面但第一張是 1：重新編號後放在 0 與 1024 之間', async () => {
        findNextCardPosition.mockResolvedValueOnce(1).mockResolvedValue(1024);

        await service.moveCard({ ...dto, afterCardId: null }, userId);

        expect(renumberColumnCards).toHaveBeenCalledTimes(1);
        expect(movedPosition()).toBe(512);
      });

      it('有空間時不重新編號', async () => {
        findCardPositionInColumn.mockResolvedValue(1024);
        findNextCardPosition.mockResolvedValue(2048);

        await service.moveCard(dto, userId);

        expect(renumberColumnCards).not.toHaveBeenCalled();
      });

      it('移動成功：回傳卡片與 boardRevision', async () => {
        findCardSnapshot.mockResolvedValue(
          createCard({ columnId: 'column-2', position: 2048 }),
        );

        const result = await service.moveCard(dto, userId);

        expect(moveCardRecord).toHaveBeenCalledWith(
          'card-1',
          'column-2',
          expect.any(Number),
          tx,
        );
        expect(findCardSnapshot).toHaveBeenCalledWith('card-1', tx);
        expect(result).toEqual({
          boardRevision: '13',
          card: expect.objectContaining({
            id: 'card-1',
            columnId: 'column-2',
            position: 2048,
          }) as unknown,
        });
      });

      it('卡片在檢查後被封存（移動 0 筆）時丟 404', async () => {
        moveCardRecord.mockResolvedValue(0);

        const exception = await catchError(dto);

        expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(findCardSnapshot).not.toHaveBeenCalled();
      });
    });
  });
});
