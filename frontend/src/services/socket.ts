import type { ServerToClientEvents, ClientToServerEvents } from '@kanban/contracts/socket';
import { io, type Socket } from 'socket.io-client';
import { ref } from 'vue';
export const isConnected = ref<boolean>(false);

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  import.meta.env.VITE_API_URL,
  {
    autoConnect: false,
    withCredentials: true,
  },
);

socket.on('connect', () => {
  isConnected.value = true;
});

socket.on('disconnect', () => {
  isConnected.value = false;
});

export const connect = () => {
  socket.connect();
};

export const disconnect = () => {
  socket.disconnect();
};

export const ensureConnected = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const emitEcho = (message: string) => {
  socket.emit('demo:echo', {
    text: message,
  });
};

/** 監聽通知創建 */
export const onNotificationCreated = (handler: ServerToClientEvents['notification:created']) => {
  socket.on('notification:created', handler);
};

/** 移除監聽通知創建 */
export const offNotificationCreated = (handler: ServerToClientEvents['notification:created']) => {
  socket.off('notification:created', handler);
};
