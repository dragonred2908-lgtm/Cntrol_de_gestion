import { Server as SocketIOServer } from 'socket.io';
import { ConnectedClient, state } from './init.js';
import { Order } from '../src/types.js';

export function registerSocketHandlers(
  io: SocketIOServer,
  connectedDevices: Map<string, ConnectedClient>
) {
  function broadcastPresence() {
    const devices = Array.from(connectedDevices.values());
    io.emit('mirror:presence', {
      count: Math.max(1, devices.length),
      devices,
    });
  }

  io.on('connection', (socket) => {
    const query = socket.handshake.query;
    const role = (query.role as string) || 'admin';
    const name = (query.name as string) || 'Consola de Control';
    const deviceType = ((query.deviceType as string) || 'desktop') as 'desktop' | 'mobile' | 'tablet';

    connectedDevices.set(socket.id, {
      id: socket.id,
      role,
      name,
      deviceType,
      connectedAt: new Date().toISOString(),
    });

    broadcastPresence();

    socket.on('mirror:ping', (ack) => {
      if (typeof ack === 'function') ack();
    });

    socket.on('mirror:device_join', (data) => {
      if (connectedDevices.has(socket.id)) {
        const dev = connectedDevices.get(socket.id)!;
        dev.role = data.role || dev.role;
        dev.name = data.name || dev.name;
        dev.deviceType = data.deviceType || dev.deviceType;
        broadcastPresence();
      }
    });

    socket.on('mirror:order_update', (order: Order) => {
      socket.broadcast.emit('mirror:order_updated', order);
    });

    socket.on('mirror:order_create', (order: Order) => {
      socket.broadcast.emit('mirror:order_created', order);
    });

    socket.on('mirror:request_sync', () => {
      socket.emit('mirror:orders_full', state.db.orders);
    });

    socket.on('disconnect', () => {
      connectedDevices.delete(socket.id);
      broadcastPresence();
    });
  });
}
