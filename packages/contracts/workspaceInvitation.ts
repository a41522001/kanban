import type { WorkspaceRole } from './workspaces.js';

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

export interface AcceptOrDeclineInvitationRequest {
  invitationId: string;
}

/**
 * 工作區邀請詳細資訊。
 *
 * 這是點擊通知後供邀請 Dialog 使用的資料，不應與通知列表的摘要欄位混用。
 * 目前建立邀請時 role 固定為 MEMBER，但型別沿用 WorkspaceRole 以保持與
 * 工作區成員領域模型一致，未來擴充邀請角色時不需要改 API 結構。
 */
export interface WorkspaceInvitationDetail {
  invitationId: string;
  workspaceId: string;
  workspaceName: string;
  inviterName: string | null;
  role: WorkspaceRole;
  status: WorkspaceInvitationStatus;
  expiresAt: string;
  respondedAt: string | null;
}
