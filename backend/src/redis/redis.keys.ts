export const redisKeys = {
  session: (sessionIdHash: string) => `session:token:${sessionIdHash}`,
  userSessions: (userid: string) => `user:sessions:${userid}`,
  dragSession: (projectId: string) => `lock:projectDragSession:${projectId}`,
};
