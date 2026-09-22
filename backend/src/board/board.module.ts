import { Module } from '@nestjs/common';
import { BoardController } from './board.controller';
import { BoardService } from './board.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { ProjectModule } from '@/project/project.module';
import { SessionModule } from '@/session/session.module';
import { BoardRepository } from './board.repository';

@Module({
  controllers: [BoardController],
  providers: [BoardService, BoardRepository],
  imports: [PrismaModule, ProjectModule, SessionModule],
  exports: [BoardService],
})
export class BoardModule {}
