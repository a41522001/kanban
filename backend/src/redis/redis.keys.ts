export const redisKeys = {
  session: (sessionIdHash: string) => `session:${sessionIdHash}`,
};
