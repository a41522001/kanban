export type WorkspaceInvitationStatus =
  /// 等待受邀者回覆。
  | 'PENDING'
  /// 受邀者已接受，並已建立 WorkspaceMember。
  | 'ACCEPTED'
  /// 受邀者主動拒絕。
  | 'DECLINED'
  /// 邀請者或 Workspace Owner 主動取消。
  | 'CANCELED'
  /// 超過 expiresAt 後失效。
  | 'EXPIRED';

export interface InviteWorkspaceMemberRequest {
  workspaceId: string;
  email: string;
}
