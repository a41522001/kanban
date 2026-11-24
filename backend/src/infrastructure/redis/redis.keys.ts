export const redisKeys = {
  session: (sessionIdHash: string) => `session:token:${sessionIdHash}`,
  userSessions: (userid: string) => `user:sessions:${userid}`,
  verifyEmail: (token: string) => `verify:email:${token}`,
  rateLimitEmailVerify: (email: string) => `rateLimit:emailVerify:${email}`,
  rateLimitAvatarUpload: (userId: string) => `rateLimit:avatarUpload:${userId}`,
  rateLimitLoginEmailIp: (email: string, ip: string) =>
    `rateLimit:login:emailIp:${email}:${ip}`,
  rateLimitLoginIp: (ip: string) => `rateLimit:login:ip:${ip}`,
  rateLimitLoginEmail: (email: string) => `rateLimit:login:email:${email}`,
  rateLimitSignupIp: (ip: string) => `rateLimit:signup:ip:${ip}`,
  cardDrag: (projectId: string, cardId: string) =>
    `lock:cardDrag:${projectId}:${cardId}`,
  // One lock per scheduled job, so only one instance runs it at a time.
  cronExpireWorkspaceInvitations: () => 'lock:cron:expireWorkspaceInvitations',
};
