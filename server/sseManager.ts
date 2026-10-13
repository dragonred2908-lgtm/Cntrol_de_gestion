import { Response } from 'express';

export interface SSEClient {
  id: string;
  res: Response;
  connectedAt: string;
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatPeriodMs: number = 20000; // 20 seconds as requested

  constructor() {
    this.startHeartbeat();
  }

  public addClient(id: string, res: Response): void {
    // Configure SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Prevent Nginx proxy buffering
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const client: SSEClient = {
      id,
      res,
      connectedAt: new Date().toISOString(),
    };

    this.clients.set(id, client);

    // Initial handshake event
    this.sendToClient(res, 'connected', {
      clientId: id,
      timestamp: new Date().toISOString(),
      heartbeatPeriodSeconds: this.heartbeatPeriodMs / 1000,
      activeClientsCount: this.clients.size,
      message: 'Canal SSE activo y conectado a NÚCLEO CONTROL',
    });

    console.log(`[SSE] Nuevo cliente conectado: ${id}. Clientes activos: ${this.clients.size}`);
  }

  public removeClient(id: string): void {
    if (this.clients.has(id)) {
      this.clients.delete(id);
      console.log(`[SSE] Cliente desconectado: ${id}. Clientes activos: ${this.clients.size}`);
    }
  }

  public getClientsCount(): number {
    return this.clients.size;
  }

  public broadcast(eventType: string, data: any): void {
    const payload = JSON.stringify(data);
    const message = `event: ${eventType}\ndata: ${payload}\n\n`;

    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(message);
      } catch (err) {
        console.error(`[SSE] Error enviando a cliente ${id}:`, err);
        this.removeClient(id);
      }
    }
  }

  private sendToClient(res: Response, eventType: string, data: any): void {
    try {
      res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error('[SSE] Error enviando handshake a cliente:', err);
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      if (this.clients.size === 0) return;

      const heartbeatPayload = {
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
        clientsCount: this.clients.size,
        uptime: process.uptime(),
      };

      // Both event: heartbeat and comment line keep-alive
      const dataStr = JSON.stringify(heartbeatPayload);
      const heartbeatMsg = `: keep-alive\nevent: heartbeat\ndata: ${dataStr}\n\n`;

      for (const [id, client] of this.clients.entries()) {
        try {
          client.res.write(heartbeatMsg);
        } catch (err) {
          console.error(`[SSE] Error en heartbeat para ${id}:`, err);
          this.removeClient(id);
        }
      }
    }, this.heartbeatPeriodMs);
  }

  public destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    for (const [, client] of this.clients.entries()) {
      try {
        client.res.end();
      } catch {}
    }
    this.clients.clear();
  }
}

export const sseManager = new SSEManager();
