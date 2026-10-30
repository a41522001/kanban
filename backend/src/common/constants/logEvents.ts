/**
 * 應用程式 log 的 event 代號。
 * 格式為「模組.動作.結果」，全小寫，以 `.` 分層、單字間用 `_`（見 docs/architecture/logging.md §4.2）。
 * 新增 event 時先在這裡加一行，再於 log 或 AppException 使用，避免打錯字與同義不同名。
 */
export const LOG_EVENTS = {
  // HTTP（全域 HttpExceptionFilter）
  httpRequestUnexpectedError: 'http.request.unexpected_error',

  // BullMQ Worker（email、avatar 共用）
  queueJobCompleted: 'queue.job.completed',
  queueJobFailed: 'queue.job.failed',

  // Worker process
  workerProcessStarted: 'worker.process.started',

  // Auth
  authSignupEmailEnqueueFailed: 'auth.signup.email_enqueue_failed',
  authResendEmailEnqueueFailed: 'auth.resend_verification.email_enqueue_failed',

  // Avatar
  avatarUploadWriteFailed: 'avatar.upload.write_failed',
  avatarUploadSaveFailed: 'avatar.upload.save_failed',
  avatarUploadEnqueueFailed: 'avatar.upload.enqueue_failed',
  avatarVariantsMarkedFailed: 'avatar.variants.marked_failed',
  avatarVariantsSkipped: 'avatar.variants.skipped',
  avatarVariantsDecodeFailed: 'avatar.variants.decode_failed',
  avatarVariantsStatusUpdateFailed: 'avatar.variants.status_update_failed',
  avatarStorageDeleteFailed: 'avatar.storage.delete_failed',

  // Workspace invitation
  workspaceInvitationExpireCompleted: 'workspace_invitation.expire.completed',

  // Redis
  redisClientError: 'redis.client.error',

  // Socket.IO
  socketConnectionConnected: 'socket.connection.connected',
  socketConnectionDisconnected: 'socket.connection.disconnected',
  socketWorkspaceJoinRejected: 'socket.workspace.join_rejected',
} as const;

/** 所有合法 event 字串組成的型別，可用來約束 `AppException` 的 `event`。 */
export type LogEvent = (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS];
