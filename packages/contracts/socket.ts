import type { PublicNotification } from './notification.js';

export type EchoPayload = {
  text: string;
};

export interface ServerToClientEvents {
  'demo:echoed': (payload: EchoPayload & { serverTime: string }) => void;
  'notification:created': (notification: PublicNotification) => void;
}

export interface ClientToServerEvents {
  'demo:echo': (payload: EchoPayload) => void;
}
