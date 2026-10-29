import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifySessionToken } from './auth.js';

export function createSocketServer(httpServer: http.Server) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });

  // Autenticación por token en handshake (query o auth)
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const claims = verifySessionToken(token as string | undefined);
    if (!claims) return next(new Error('Unauthorized'));
    // @ts-expect-error adjuntamos claims al socket
    socket.authClaims = claims;
    next();
  });

  return io;
}

export function createHttpServerForApp() {
  return http.createServer();
}
