import { Module } from '@nestjs/common';
import { SessionModule } from '@/modules/session/session.module';
import { StorageModule } from '@/infrastructure/storage/storage.module';
import { AvatarController } from './avatar.controller';
import { AvatarRepository } from './avatar.repository';
import { AvatarService } from './avatar.service';
import { AvatarRateLimitGuard } from './avatarRateLimit.guard';
import { ImageProcessingService } from './image/imageProcessing.service';
import { QueueModule } from '@/infrastructure/queue/queue.module';

@Module({
  imports: [SessionModule, StorageModule, QueueModule],
  controllers: [AvatarController],
  providers: [
    AvatarService,
    AvatarRepository,
    ImageProcessingService,
    AvatarRateLimitGuard,
  ],
  exports: [],
})
export class AvatarModule {}
