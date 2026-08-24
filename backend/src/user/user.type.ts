import type { User } from '@/generated/prisma/client';

export type CreateUserData = Pick<
  User,
  'email' | 'displayName' | 'passwordHash'
> & {
  avatarUrl?: string | null;
};
