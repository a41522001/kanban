import type { PublicNotification } from './notification.js';
import type { AddCategoryResult, AddColumnResult, ArchiveCardResult, CardMutationResult, MoveColumnResult } from './board.js';

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

/** 卡片拖曳開始／結束事件的資料（client 送出與 server 廣播共用）；不含拖曳者的識別資料。 */
export type CardDragPayload = {
  projectId: string;
  cardId: string;
};

/**
 * 卡片拖曳鎖的取得結果。
 * - `acquired`：取得鎖。
 * - `locked`：無法取得，包含卡片已被其他連線鎖住，以及沒有權限（非 OWNER／EDITOR、非成員）；前端兩者處理相同。
 * - `unavailable`：伺服器暫時無法判斷（例如 Redis 錯誤）；前端放行，照常存檔（fail-open）。
 */
export type CardDragAckStatus = 'acquired' | 'locked' | 'unavailable';

/** `card:dragStart` 的 ack 回應。 */
export type CardDragStartAck = {
  status: CardDragAckStatus;
};

/**
 * 卡片拖曳鎖的 TTL（毫秒），不續約。
 * 後端用於 Redis 鎖的過期時間；前端收到 `board:cardDragStarted` 後以同一個值計時，
 * 時間到就清除「有人正在移動」提示（鎖因 TTL 過期時伺服器不會廣播結束）。
 */
export const CARD_DRAG_LOCK_TTL_MS = 30_000;

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
  'board:columnMoved': BoardEvent<MoveColumnResult>;
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
  'board:columnMoved': (payload: BoardEventPayloads['board:columnMoved']) => void;
  'board:cardDragStarted': (payload: CardDragPayload) => void;
  'board:cardDragEnded': (payload: CardDragPayload) => void;
}

/** Client 傳送給 Server 的 WebSocket 事件契約。 */
export interface ClientToServerEvents {
  'demo:echo': (payload: EchoPayload) => void;
  'workspace:into': (payload: WorkspaceRoomPayload) => void;
  'workspace:leave': (payload: WorkspaceRoomPayload) => void;
  'project:into': (payload: ProjectRoomPayload) => void;
  'project:leave': (payload: ProjectRoomPayload) => void;
  'card:dragStart': (payload: CardDragPayload, callback: (result: CardDragStartAck) => void) => void;
  'card:dragEnd': (payload: CardDragPayload) => void;
}
