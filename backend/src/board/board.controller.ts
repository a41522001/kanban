import type { ApiResult } from '@kanban/contracts/api';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AddBoardColumnDto } from './dto/addBoardColumn.dto';
import { MoveBoardColumnDto } from './dto/moveBoardColumn.dto';
import { SessionGuard } from '@/session/session.guard';
import { BoardService } from './board.service';

@Controller('board')
@UseGuards(SessionGuard)
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Get(':projectId')
  async getBoardSnapshot(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: Request,
  ) {
    const result = await this.boardService.getBoardColumn(
      projectId,
      req.userId!,
    );
    return {
      data: result,
      message: '',
    };
  }

  @Post('addColumn')
  async createBoardColumn(
    @Body() addBoardColumnDto: AddBoardColumnDto,
    @Req() req: Request,
  ) {
    const result = await this.boardService.createBoardColumn(
      addBoardColumnDto,
      req.userId!,
    );
    return {
      data: result,
      message: '',
    };
  }

  @Patch('moveColumn')
  async moveBoardColumn(
    @Body() moveBoardColumnDto: MoveBoardColumnDto,
    @Req() req: Request,
  ): Promise<ApiResult<null>> {
    await new Promise((resolve) => resolve(1));
    return {
      data: null,
      message: '',
    };
  }
}
