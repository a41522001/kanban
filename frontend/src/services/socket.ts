import type { ServerToClientEvents, ClientToServerEvents } from '@kanban/contracts/socket';
import { io, type Socket } from 'socket.io-client';
import { ref } from 'vue';
// #region 斷線重連需要添加的內容
let hasConnectedBefore = false;
let currentWorkspaceId: string | null = null;
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
