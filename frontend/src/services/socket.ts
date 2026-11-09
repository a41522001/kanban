import type {
  BoardEventPayloads,
  ServerToClientEvents,
  ClientToServerEvents,
  ProjectRoomPayload,
} from '@kanban/contracts/socket';
import { io, type Socket } from 'socket.io-client';
import { ref } from 'vue';
// #region 斷線重連需要添加的內容
let hasConnectedBefore = false;
let currentWorkspaceId: string | null = null;
let currentProjectId: string | null = null;
// 存放所有登記進來的函式
const reconnectedHandlers = new Set<() => void>();
// #endregion

export const isConnected = ref<boolean>(false);

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  import.meta.env.VITE_SOCKET_URL,
  {
    autoConnect: false,
    withCredentials: true,
  },
);

socket.on('connect', () => {
  isConnected.value = true;
  if (currentWorkspaceId !== null) {
    emitWorkspaceInto(currentWorkspaceId);
  }
  if (currentProjectId !== null) {
    emitProjectInto(currentProjectId);
  }
  if (hasConnectedBefore) {
    reconnectedHandlers.forEach((handler) => handler());
  }
  hasConnectedBefore = true;
});

socket.on('disconnect', () => {
  isConnected.value = false;
});

export const connect = () => {
  socket.connect();
};

export const disconnect = () => {
  socket.disconnect();
  hasConnectedBefore = false;
  currentWorkspaceId = null;
  currentProjectId = null;
};

export const ensureConnected = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

// #region emit

/** echo */
export const emitEcho = (message: string) => {
  socket.emit('demo:echo', {
    text: message,
  });
};

/** 進入工作區 */
export const emitWorkspaceInto = (workspaceId: string) => {
  const payload = {
    workspaceId,
  };
  socket.emit('workspace:into', payload);
  currentWorkspaceId = workspaceId;
};

/** 離開工作區 */
export const emitWorkspaceLeave = (workspaceId: string) => {
  const payload = {
    workspaceId,
  };
  socket.emit('workspace:leave', payload);
  if (workspaceId === currentWorkspaceId) {
    currentWorkspaceId = null;
  }
};

/** 進入專案（看板） */
export const emitProjectInto = (projectId: string) => {
  const payload: ProjectRoomPayload = {
    projectId,
  };
  socket.emit('project:into', payload);
  currentProjectId = projectId;
};

/** 離開專案（看板） */
export const emitProjectLeave = (projectId: string) => {
  const payload: ProjectRoomPayload = {
    projectId,
  };
  socket.emit('project:leave', payload);
  if (projectId === currentProjectId) {
    currentProjectId = null;
  }
};

// #endregion

// #region on

/** 監聽斷線重連成功 */
export const onReconnected = (handler: () => void) => {
  reconnectedHandlers.add(handler);
};

/** 監聽通知創建 */
export const onNotificationCreated = (handler: ServerToClientEvents['notification:created']) => {
  socket.on('notification:created', handler);
};

/** 監聽工作區成員加入 */
export const onWorkspaceMemberChanged = (
  handler: ServerToClientEvents['workspace:memberChanged'],
) => {
  socket.on('workspace:memberChanged', handler);
};

// #endregion

// #region off

/** 移除監聽斷線重連成功 */
export const offReconnected = (handler: () => void) => {
  reconnectedHandlers.delete(handler);
};

/** 移除監聽通知創建 */
export const offNotificationCreated = (handler: ServerToClientEvents['notification:created']) => {
  socket.off('notification:created', handler);
};

/** 移除工作區成員加入 */
export const offWorkspaceMemberChanged = (
  handler: ServerToClientEvents['workspace:memberChanged'],
) => {
  socket.off('workspace:memberChanged', handler);
};

// #endregion

// #region board
/** One handler per board event (Board spec §7.2). */
export type BoardEventHandlers = {
  [E in keyof BoardEventPayloads]: (payload: BoardEventPayloads[E]) => void;
};

/** 監聽看板事件 */
export const onBoardEvents = (handlers: BoardEventHandlers) => {
  socket.on('board:columnCreated', handlers['board:columnCreated']);
  socket.on('board:cardCreated', handlers['board:cardCreated']);
  socket.on('board:cardUpdated', handlers['board:cardUpdated']);
  socket.on('board:cardMoved', handlers['board:cardMoved']);
  socket.on('board:cardArchived', handlers['board:cardArchived']);
  socket.on('board:categoryCreated', handlers['board:categoryCreated']);
};

/** 移除監聽看板事件；需傳入註冊時的同一組 handlers */
export const offBoardEvents = (handlers: BoardEventHandlers) => {
  socket.off('board:columnCreated', handlers['board:columnCreated']);
  socket.off('board:cardCreated', handlers['board:cardCreated']);
  socket.off('board:cardUpdated', handlers['board:cardUpdated']);
  socket.off('board:cardMoved', handlers['board:cardMoved']);
  socket.off('board:cardArchived', handlers['board:cardArchived']);
  socket.off('board:categoryCreated', handlers['board:categoryCreated']);
};
// #endregion
