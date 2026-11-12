import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiCode } from '@kanban/contracts/api';
import { AppException } from '@/common/exceptions/app.exception';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { SocketService } from '@/modules/socket/socket.service';
import { BoardRepository } from '../board.repository';
import { CardCategoryService } from './cardCategory.service';
import type { AddCategoryDto } from '../dto/addCategory.dto';

const projectId = 'project-1';
const userId = 'user-1';

describe('CardCategoryService', () => {
  let service: CardCategoryService;
  let incrementBoardRevision: jest.MockedFunction<
    BoardRepository['incrementBoardRevision']
  >;
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
  let transaction: jest.Mock;
  let emitToProject: jest.Mock;
  // Stand-in for the Prisma transaction client passed to the callback.
  const tx = { isTransaction: true };

  beforeEach(async () => {
    incrementBoardRevision = jest.fn().mockResolvedValue(13n);
    findEditableProject = jest.fn().mockResolvedValue({ id: projectId });
    findCategoryByNormalizedName = jest.fn().mockResolvedValue(null);
    getBoardRevision = jest.fn().mockResolvedValue(12n);
    countCategories = jest.fn().mockResolvedValue(3);
    createCategoryRecord = jest.fn().mockResolvedValue({
      id: 'category-1',
      name: 'Backend',
      colorKey: 'mint',
    });
    emitToProject = jest.fn();
    transaction = jest.fn((callback: (client: unknown) => unknown) =>
      callback(tx),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardCategoryService,
        {
          provide: BoardRepository,
          useValue: {
            incrementBoardRevision,
            findEditableProject,
            findCategoryByNormalizedName,
            getBoardRevision,
            countCategories,
            createCategory: createCategoryRecord,
          },
        },
        { provide: PrismaService, useValue: { $transaction: transaction } },
        { provide: SocketService, useValue: { emitToProject } },
      ],
    }).compile();

    service = module.get(CardCategoryService);
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

  describe('廣播（C-2，Board 規格 §7.2）', () => {
    /** emit 必須在 transaction 回傳（commit）之後。 */
    const expectEmittedAfterCommit = () => {
      expect(transaction.mock.invocationCallOrder[0]).toBeLessThan(
        emitToProject.mock.invocationCallOrder[0],
      );
    };

    it('addCategory 建立新類別：廣播 board:categoryCreated，回應與事件都不含 created', async () => {
      const result = await service.addCategory(
        { projectId, name: 'Backend', colorKey: 'mint' },
        userId,
      );

      expect(result).toEqual({
        category: { id: 'category-1', name: 'Backend', colorKey: 'mint' },
        boardRevision: '13',
      });
      expect(emitToProject).toHaveBeenCalledTimes(1);
      expect(emitToProject).toHaveBeenCalledWith('board:categoryCreated', {
        ...result,
        projectId,
      });
      expectEmittedAfterCommit();
    });

    it('addCategory 沿用既有類別（revision 不變）時不廣播，回應不含 created', async () => {
      findCategoryByNormalizedName.mockResolvedValue({
        id: 'category-9',
        name: 'backend',
        colorKey: 'teal',
      });

      const result = await service.addCategory(
        { projectId, name: 'Backend', colorKey: 'mint' },
        userId,
      );

      expect(result).not.toHaveProperty('created');
      expect(emitToProject).not.toHaveBeenCalled();
    });

    it('addCategory 達上限（409）時不廣播', async () => {
      countCategories.mockResolvedValue(50);

      await service
        .addCategory({ projectId, name: 'Backend', colorKey: 'mint' }, userId)
        .catch(() => undefined);

      expect(emitToProject).not.toHaveBeenCalled();
    });
  });
});
