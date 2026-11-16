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
import { BoardColumnService } from './column/boardColumn.service';
import { CardService } from './card/card.service';
import { CardCategoryService } from './category/cardCategory.service';
import { AddCardDto } from './dto/addCard.dto';
import { UpdateCardDto } from './dto/updateCard.dto';
import { ArchiveCardDto } from './dto/archiveCard.dto';
import { AddCategoryDto } from './dto/addCategory.dto';
import { MoveCardDto } from './dto/moveCard.dto';
import type {
  AddCategoryResult,
  ArchiveCardResult,
  CardMutationResult,
  MoveColumnResult,
} from '@kanban/contracts/board';

@Controller('board')
@UseGuards(SessionGuard)
export class BoardController {
  constructor(
    private readonly boardService: BoardService,
    private readonly boardColumnService: BoardColumnService,
    private readonly cardService: CardService,
    private readonly cardCategoryService: CardCategoryService,
  ) {}

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
    const result = await this.boardColumnService.createBoardColumn(
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
    const result = await this.cardService.createCard(addCardDto, req.userId!);
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
    const result = await this.cardService.updateCard(
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
    const result = await this.cardService.archiveCard(
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
    const result = await this.cardCategoryService.addCategory(
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
    const result = await this.cardService.moveCard(moveCardDto, req.userId!);
    return {
      data: result,
      message: '',
    };
  }

  /** 移動欄位；不帶 expectedBoardRevision，afterColumnId 已不在同一專案時回 409 / ColumnMoveConflict。 */
  @Patch('moveColumn')
  async moveBoardColumn(
    @Body() moveBoardColumnDto: MoveBoardColumnDto,
    @Req() req: Request,
  ): Promise<ApiResult<MoveColumnResult>> {
    const result = await this.boardColumnService.moveBoardColumn(
      moveBoardColumnDto,
      req.userId!,
    );
    return {
      data: result,
      message: '',
    };
  }
}
