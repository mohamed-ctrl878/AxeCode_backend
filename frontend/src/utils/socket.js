import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:1337';

let socketInstance = null;

export function getSocket(token) {
  if (socketInstance?.connected) return socketInstance;

  socketInstance = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    auth: token ? { token } : undefined,
  });

  socketInstance.on('connect', () => {
    console.log('[Socket] Connected', socketInstance.id);
  });

  socketInstance.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected', reason);
  });

  socketInstance.on('connect_error', (err) => {
    console.error('[Socket] Connection error', err.message);
  });

  return socketInstance;
}

export function joinConversation(conversationId) {
  if (!socketInstance?.connected) return;
  socketInstance.emit('join-conversation', conversationId);
}

export function leaveConversation(conversationId) {
  if (!socketInstance?.connected) return;
  socketInstance.emit('leave-conversation', conversationId);
}

export function onNewMessage(cb) {
  socketInstance?.on('new-message', cb);
}

export function offNewMessage(cb) {
  socketInstance?.off('new-message', cb);
}