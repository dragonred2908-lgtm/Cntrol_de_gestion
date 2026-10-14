import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

export function createSocketServer(httpServer: http.Server) {
  return new SocketIOServer(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });
}

export function createHttpServerForApp() {
  return http.createServer();
}
