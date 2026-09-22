import { HttpStatus, Injectable } from '@nestjs/common';
import { BoardRepository } from './board.repository';
import { AddBoardColumnDto } from './dto/addBoardColumn.dto';
import { ProjectService } from '@/project/project.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ApiCode } from '@kanban/contracts/api';
import { PrismaService } from '@/prisma/prisma.service';

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
}
