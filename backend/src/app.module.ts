import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { envSchema } from './config/env';
import { loggerFactory } from './config/logger.config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SessionModule } from './session/session.module';
import { SocketModule } from './socket/socket.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { UserModule } from './user/user.module';
import { NotificationModule } from './notification/notification.module';
import { HttpExceptionFilter } from './common/filters/httpException.filter';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { WrapResponseInterceptor } from './common/interceptors/wrapResponse.interceptor';
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
      useFactory: loggerFactory,
    }),
    PrismaModule,
    RedisModule,
    SessionModule,
    SocketModule,
    AuthModule,
    WorkspacesModule,
    UserModule,
    NotificationModule,
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
