import http from 'http';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app.js';
import { createSocketServer } from './server/socket.js';
import { config } from './server/config.js';
import { telegramController, connectedDevices } from './server/init.js';
import { registerSocketHandlers } from './server/socketHandlers.js';
import { startTelegramPoller, stopTelegramPoller } from './server/telegramPoller.js';

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
    // Assets con hash: caché inmutable de 1 año
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), { immutable: true, maxAge: '1y' })
    );
    // Resto de archivos estáticos; el HTML siempre se revalida
    app.use(
      express.static(distPath, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(config.port, '0.0.0.0', () => {
    console.log(`Control de Gestión Server & Socket.io running at http://0.0.0.0:${config.port}`);
    // Start background Telegram poller
    startTelegramPoller();
    // Barrido automático diario de integrantes del grupo
    telegramController.startDailyMemberSync(24);
  });

  // Cierre ordenado (Docker/systemd)
  const shutdown = (signal: string) => {
    console.log(`[server] ${signal} recibido. Cerrando servidor...`);
    stopTelegramPoller();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
