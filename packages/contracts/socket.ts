import type { PublicNotification } from './notification.js';

export type EchoPayload = {
  text: string;
};
export type WorkspaceRoomPayload = {
  workspaceId: string;
};
export type WorkspaceMemberChangedPayload = {
  workspaceId: string;
};
export interface ServerToClientEvents {
  'demo:echoed': (payload: EchoPayload & { serverTime: string }) => void;
  'notification:created': (notification: PublicNotification) => void;
  'workspace:memberChanged': (payload: WorkspaceMemberChangedPayload) => void;
}

export interface ClientToServerEvents {
  'demo:echo': (payload: EchoPayload) => void;
  'workspace:into': (payload: WorkspaceRoomPayload) => void;
  'workspace:leave': (payload: WorkspaceRoomPayload) => void;
}
