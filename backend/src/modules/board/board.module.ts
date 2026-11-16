import { Module } from '@nestjs/common';
import { BoardController } from './board.controller';
import { BoardService } from './board.service';
import { BoardColumnService } from './column/boardColumn.service';
import { CardService } from './card/card.service';
import { CardCategoryService } from './category/cardCategory.service';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module';
import { ProjectModule } from '@/modules/project/project.module';
import { SessionModule } from '@/modules/session/session.module';
import { BoardRepository } from './board.repository';
import { SocketModule } from '@/modules/socket/socket.module';

@Module({
  controllers: [BoardController],
  providers: [
    BoardService,
    BoardColumnService,
    CardService,
    CardCategoryService,
    BoardRepository,
  ],
  imports: [PrismaModule, ProjectModule, SessionModule, SocketModule],
})
export class BoardModule {}
