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
import { SessionGuard } from '@/modules/session/session.guard';
import { BoardService } from './board.service';
import { AddCardDto } from './dto/addCard.dto';
import { UpdateCardDto } from './dto/updateCard.dto';
import { ArchiveCardDto } from './dto/archiveCard.dto';
import { AddCategoryDto } from './dto/addCategory.dto';
import { MoveCardDto } from './dto/moveCard.dto';
import type {
  AddCategoryResult,
  ArchiveCardResult,
  CardMutationResult,
} from '@kanban/contracts/board';

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

  @Post('addCard')
  async createCard(
    @Body() addCardDto: AddCardDto,
    @Req() req: Request,
  ): Promise<ApiResult<CardMutationResult>> {
    const result = await this.boardService.createCard(addCardDto, req.userId!);
    return {
      data: result,
      message: '',
    };
  }

  @Patch('updateCard')
  async updateCard(
    @Body() updateCardDto: UpdateCardDto,
    @Req() req: Request,
  ): Promise<ApiResult<CardMutationResult>> {
    const result = await this.boardService.updateCard(
      updateCardDto,
      req.userId!,
    );
    return {
      data: result,
      message: '',
    };
  }

  @Patch('archiveCard')
  async archiveCard(
    @Body() archiveCardDto: ArchiveCardDto,
    @Req() req: Request,
  ): Promise<ApiResult<ArchiveCardResult>> {
    const result = await this.boardService.archiveCard(
      archiveCardDto,
      req.userId!,
    );
    return {
      data: result,
      message: '',
    };
  }

  /** 建立類別；名稱已存在時回傳既有的那一筆（同樣是 201，boardRevision 不變）。 */
  @Post('addCategory')
  async addCategory(
    @Body() addCategoryDto: AddCategoryDto,
    @Req() req: Request,
  ): Promise<ApiResult<AddCategoryResult>> {
    const result = await this.boardService.addCategory(
      addCategoryDto,
      req.userId!,
    );
    return {
      data: result,
      message: '',
    };
  }

  /** 移動卡片；不帶 expectedVersion，afterCardId 已不在目標欄位時回 409 / CardMoveConflict。 */
  @Patch('moveCard')
  async moveCard(
    @Body() moveCardDto: MoveCardDto,
    @Req() req: Request,
  ): Promise<ApiResult<CardMutationResult>> {
    const result = await this.boardService.moveCard(moveCardDto, req.userId!);
    return {
      data: result,
      message: '',
    };
  }

  @Patch('moveColumn')
  async moveBoardColumn(
    @Body() _moveBoardColumnDto: MoveBoardColumnDto,
    @Req() _req: Request,
  ): Promise<ApiResult<null>> {
    await new Promise((resolve) => resolve(1));
    return {
      data: null,
      message: '',
    };
  }
}
