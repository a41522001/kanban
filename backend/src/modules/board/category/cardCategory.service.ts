import { HttpStatus, Injectable } from '@nestjs/common';
import { BoardRepository } from '../board.repository';
import { SocketService } from '@/modules/socket/socket.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import type { AddCategoryResult } from '@kanban/contracts/board';
import { AddCategoryDto } from '../dto/addCategory.dto';
import { toCategorySnapshot } from '../board.mappers';

/** 卡片類別：建立，以及給卡片使用的同專案檢查（Board 規格 §4.5）。 */
@Injectable()
export class CardCategoryService {
  constructor(
    private readonly boardRepository: BoardRepository,
    private readonly prismaService: PrismaService,
    private readonly socketService: SocketService,
  ) {}

  /**
   * 建立類別；名稱（trim 後不分大小寫）已存在時沿用既有的那一筆，boardRevision 不變（Board 規格 §4.5）。
   */
  async addCategory(
    data: AddCategoryDto,
    userId: string,
  ): Promise<AddCategoryResult> {
    const projectAuth = await this.boardRepository.findEditableProject(
      data.projectId,
      userId,
    );
    if (projectAuth === null) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到專案或你沒有存取權限',
        code: ApiCode.ResourceNotFound,
      });
    }

    const normalizedName = data.name.toLowerCase();

    const { created, ...categoryResult } =
      await this.prismaService.$transaction(async (tx) => {
        const existing =
          await this.boardRepository.findCategoryByNormalizedName(
            data.projectId,
            normalizedName,
            tx,
          );
        if (existing) {
          const currentRevision = await this.boardRepository.getBoardRevision(
            data.projectId,
            tx,
          );
          return {
            created: false,
            category: toCategorySnapshot(existing),
            boardRevision: currentRevision.toString(),
          };
        }

        const boardRevision = await this.boardRepository.incrementBoardRevision(
          data.projectId,
          tx,
        );
        const count = await this.boardRepository.countCategories(
          data.projectId,
          tx,
        );
        if (count >= 50) {
          throw new AppException({
            status: HttpStatus.CONFLICT,
            message: '這個專案的類別已達 50 個上限',
            code: ApiCode.CardCategoryLimitExceeded,
          });
        }

        const category = await this.boardRepository.createCategory(
          {
            projectId: data.projectId,
            name: data.name,
            normalizedName,
            colorKey: data.colorKey,
          },
          tx,
        );
        return {
          created: true,
          category: toCategorySnapshot(category),
          boardRevision: boardRevision.toString(),
        };
      });

    if (created) {
      const payload = {
        projectId: data.projectId,
        ...categoryResult,
      };
      this.socketService.emitToProject('board:categoryCreated', payload);
    }
    return categoryResult;
  }

  /**
   * 類別必須屬於卡片所在專案（Board 規格 Q12），否則一律 404，不透露 id 是否存在於別的專案。
   * 類別不能刪除（Q7），所以在 transaction 外檢查即可，不會有檢查後被刪掉的競態。
   */
  async assertCategoryInProject(
    categoryId: string,
    projectId: string,
  ): Promise<void> {
    const category = await this.boardRepository.findCategoryInProject(
      categoryId,
      projectId,
    );
    if (category === null) {
      throw new AppException({
        status: HttpStatus.NOT_FOUND,
        message: '找不到類別',
        code: ApiCode.ResourceNotFound,
      });
    }
  }
}
