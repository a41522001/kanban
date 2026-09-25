import { Module } from '@nestjs/common';
import { BoardController } from './board.controller';
import { BoardService } from './board.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { ProjectModule } from '@/project/project.module';
import { SessionModule } from '@/session/session.module';
import { BoardRepository } from './board.repository';
import { RedisModule } from '@/redis/redis.module';

@Module({
  controllers: [BoardController],
  providers: [BoardService, BoardRepository],
  imports: [PrismaModule, ProjectModule, SessionModule, RedisModule],
  exports: [BoardService],
})
export class BoardModule {}
