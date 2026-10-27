import { Module } from '@nestjs/common';
import { BoardController } from './board.controller';
import { BoardService } from './board.service';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module';
import { ProjectModule } from '@/modules/project/project.module';
import { SessionModule } from '@/modules/session/session.module';
import { BoardRepository } from './board.repository';
import { RedisModule } from '@/infrastructure/redis/redis.module';

@Module({
  controllers: [BoardController],
  providers: [BoardService, BoardRepository],
  imports: [PrismaModule, ProjectModule, SessionModule, RedisModule],
  exports: [BoardService],
})
export class BoardModule {}
