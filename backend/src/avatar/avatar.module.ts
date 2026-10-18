import { Module } from '@nestjs/common';
import { SessionModule } from '@/session/session.module';
import { StorageModule } from '@/storage/storage.module';
import { AvatarController } from './avatar.controller';
import { AvatarRepository } from './avatar.repository';
import { AvatarService } from './avatar.service';
import { AvatarRateLimitGuard } from './avatarRateLimit.guard';
import { ImageProcessingService } from './image/imageProcessing.service';

@Module({
  imports: [SessionModule, StorageModule],
  controllers: [AvatarController],
  providers: [
    AvatarService,
    AvatarRepository,
    ImageProcessingService,
    AvatarRateLimitGuard,
  ],
})
export class AvatarModule {}
