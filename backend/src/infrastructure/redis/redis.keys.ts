export const redisKeys = {
  session: (sessionIdHash: string) => `session:token:${sessionIdHash}`,
  userSessions: (userid: string) => `user:sessions:${userid}`,
  verifyEmail: (token: string) => `verify:email:${token}`,
  rateLimitEmailVerify: (email: string) => `rateLimit:emailVerify:${email}`,
  rateLimitAvatarUpload: (userId: string) => `rateLimit:avatarUpload:${userId}`,
  cardDrag: (projectId: string, cardId: string) =>
    `lock:cardDrag:${projectId}:${cardId}`,
};
