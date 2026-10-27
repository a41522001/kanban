import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { type Env, envSchema } from './config/env';
import { loggerFactory } from './config/logger.config';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module';
import { RedisModule } from '@/infrastructure/redis/redis.module';
import { SessionModule } from '@/modules/session/session.module';
import { SocketModule } from './modules/socket/socket.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { UserModule } from './modules/user/user.module';
import { NotificationModule } from './modules/notification/notification.module';
import { HttpExceptionFilter } from './common/filters/httpException.filter';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { WrapResponseInterceptor } from './common/interceptors/wrapResponse.interceptor';
import { WorkspaceInvitationModule } from './modules/workspaceInvitation/workspaceInvitation.module';
import { ProjectModule } from './modules/project/project.module';
import { BoardModule } from './modules/board/board.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { EmailModule } from './infrastructure/email/email.module';
import { AvatarModule } from './modules/avatar/avatar.module';

const envFilePath = process.env.E2E_ENV === 'true' ? '.env.e2e' : '.env';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      validate: (config) => envSchema.parse(config),
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env>) =>
        loggerFactory(configService, 'api'),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    SessionModule,
    SocketModule,
    AuthModule,
    WorkspacesModule,
    UserModule,
    NotificationModule,
    WorkspaceInvitationModule,
    ProjectModule,
    BoardModule,
    QueueModule,
    EmailModule,
    AvatarModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useFactory: createValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: WrapResponseInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(cookieParser()).forRoutes('{*splat}');
  }
}
