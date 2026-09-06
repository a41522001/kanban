export interface CreateInvitationParams {
  workspaceId: string;
  inviteeUserId: string;
  inviterUserId: string;
  expiresAt: Date;
}
