import type { PublicNotification } from './notification.js';

/** WebSocket echo 事件的資料。 */
export type EchoPayload = {
  text: string;
};
/** 加入或離開 Workspace room 時使用的資料。 */
export type WorkspaceRoomPayload = {
  workspaceId: string;
};
/** Workspace 成員異動事件的資料。 */
export type WorkspaceMemberChangedPayload = {
  workspaceId: string;
};
/** Server 傳送給 Client 的 WebSocket 事件契約。 */
export interface ServerToClientEvents {
  'demo:echoed': (payload: EchoPayload & { serverTime: string }) => void;
  'notification:created': (notification: PublicNotification) => void;
  'workspace:memberChanged': (payload: WorkspaceMemberChangedPayload) => void;
}

/** Client 傳送給 Server 的 WebSocket 事件契約。 */
export interface ClientToServerEvents {
  'demo:echo': (payload: EchoPayload) => void;
  'workspace:into': (payload: WorkspaceRoomPayload) => void;
  'workspace:leave': (payload: WorkspaceRoomPayload) => void;
}
