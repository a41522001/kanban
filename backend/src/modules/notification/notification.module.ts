import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationRepository } from './notification.repository';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module';
import { SessionModule } from '@/modules/session/session.module';
@Module({
  imports: [PrismaModule, SessionModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationRepository],
  exports: [NotificationService],
})
export class NotificationModule {}
