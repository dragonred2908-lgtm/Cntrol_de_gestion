import http from 'http';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app.js';
import { createSocketServer } from './server/socket.js';
import { config } from './server/config.js';
import { telegramController, connectedDevices } from './server/init.js';
import { registerSocketHandlers } from './server/socketHandlers.js';
import { startTelegramPoller } from './server/telegramPoller.js';

async function bootstrap() {
  const httpServer = http.createServer();
  const io = createSocketServer(httpServer);
  const app = createApp(io);

  // Mount express app on HTTP server
  httpServer.on('request', app);

  // Provide io to telegram controller
  if (telegramController && typeof telegramController.setSocketServer === 'function') {
    telegramController.setSocketServer(io);
  }

  // Register socket handlers
  registerSocketHandlers(io, connectedDevices);

  // Vite Dev Middleware / Static Production Serving
  if (config.env !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(config.port, '0.0.0.0', () => {
    console.log(`Control de Gestión Server & Socket.io running at http://0.0.0.0:${config.port}`);
    // Start background Telegram poller
    startTelegramPoller();
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
