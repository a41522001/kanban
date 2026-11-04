import type { ConfigType } from '@nestjs/config';
import { appConfig } from './namespaces/app.config';
import { authConfig } from './namespaces/auth.config';
import { avatarConfig } from './namespaces/avatar.config';
import { databaseConfig } from './namespaces/database.config';
import { loggerConfig } from './namespaces/logger.config';
import { mailConfig } from './namespaces/mail.config';
import { redisConfig } from './namespaces/redis.config';
import { sessionConfig } from './namespaces/session.config';

/** 由 app 與 worker 的 ConfigModule.forRoot({ load }) 全域載入。 */
export const configNamespaces = [
  appConfig,
  databaseConfig,
  redisConfig,
  sessionConfig,
  authConfig,
  mailConfig,
  avatarConfig,
  loggerConfig,
];

/** 使用端一律注入 ConfigService<AppConfig, true>，以 get('session.expireDay', { infer: true }) 讀值。 */
export type AppConfig = {
  app: ConfigType<typeof appConfig>;
  database: ConfigType<typeof databaseConfig>;
  redis: ConfigType<typeof redisConfig>;
  session: ConfigType<typeof sessionConfig>;
  auth: ConfigType<typeof authConfig>;
  mail: ConfigType<typeof mailConfig>;
  avatar: ConfigType<typeof avatarConfig>;
  logger: ConfigType<typeof loggerConfig>;
};
