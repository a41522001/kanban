import type { PublicNotification } from './notification.js';
import type { AddCategoryResult, AddColumnResult, ArchiveCardResult, CardMutationResult } from './board.js';

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
/** 加入或離開 Project room 時使用的資料。 */
export type ProjectRoomPayload = {
  projectId: string;
};

/** Board 事件一律帶 projectId，前端用來忽略已離開專案的事件。 */
export type BoardEvent<T> = T & { projectId: string };

/** 每個 Board 事件的 payload；新增事件時先加在這裡 */
export interface BoardEventPayloads {
  'board:columnCreated': BoardEvent<AddColumnResult>;
  'board:cardCreated': BoardEvent<CardMutationResult>;
  'board:cardUpdated': BoardEvent<CardMutationResult>;
  'board:cardMoved': BoardEvent<CardMutationResult>;
  'board:cardArchived': BoardEvent<ArchiveCardResult>;
  'board:categoryCreated': BoardEvent<AddCategoryResult>;
}

/** Server 傳送給 Client 的 WebSocket 事件契約。 */
export interface ServerToClientEvents {
  'demo:echoed': (payload: EchoPayload & { serverTime: string }) => void;
  'notification:created': (notification: PublicNotification) => void;
  'workspace:memberChanged': (payload: WorkspaceMemberChangedPayload) => void;
  'board:columnCreated': (payload: BoardEventPayloads['board:columnCreated']) => void;
  'board:cardCreated': (payload: BoardEventPayloads['board:cardCreated']) => void;
  'board:cardUpdated': (payload: BoardEventPayloads['board:cardUpdated']) => void;
  'board:cardMoved': (payload: BoardEventPayloads['board:cardMoved']) => void;
  'board:cardArchived': (payload: BoardEventPayloads['board:cardArchived']) => void;
  'board:categoryCreated': (payload: BoardEventPayloads['board:categoryCreated']) => void;
}

/** Client 傳送給 Server 的 WebSocket 事件契約。 */
export interface ClientToServerEvents {
  'demo:echo': (payload: EchoPayload) => void;
  'workspace:into': (payload: WorkspaceRoomPayload) => void;
  'workspace:leave': (payload: WorkspaceRoomPayload) => void;
  'project:into': (payload: ProjectRoomPayload) => void;
  'project:leave': (payload: ProjectRoomPayload) => void;
}
