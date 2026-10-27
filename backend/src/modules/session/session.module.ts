import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionRepository } from './session.repository';
import { SessionGuard } from './session.guard';

@Module({
  providers: [SessionService, SessionRepository, SessionGuard],
  exports: [SessionService, SessionGuard],
})
export class SessionModule {}
