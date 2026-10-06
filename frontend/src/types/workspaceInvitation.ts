export type WorkspaceInvitationResponseState =
  | 'pending'
  | 'accepting'
  | 'declining'
  | 'accepted'
  | 'declined'
  | 'error';

export type WorkspaceInvitationResponseAction = 'accept' | 'decline';
