import { io, type Socket } from 'socket.io-client';
import { ref } from 'vue';
export const isConnected = ref<boolean>(false);
type EchoPayload = {
  text: string;
};

interface ServerToClientEvents {
  'demo:echoed': (payload: EchoPayload & { serverTime: string }) => void;
}

interface ClientToServerEvents {
  'demo:echo': (payload: EchoPayload) => void;
}

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  'http://localhost:4001',
  {
    autoConnect: false,
    withCredentials: true,
  },
);

socket.on('connect', () => {
  console.log('用戶端已連線');
  isConnected.value = true;
});

socket.on('disconnect', () => {
  console.log('用戶端已離線');
  isConnected.value = false;
});

export const connect = () => {
  socket.connect();
};

export const disconnect = () => {
  socket.disconnect();
};

export const emitEcho = (message: string) => {
  socket.emit('demo:echo', {
    text: message,
  });
};
