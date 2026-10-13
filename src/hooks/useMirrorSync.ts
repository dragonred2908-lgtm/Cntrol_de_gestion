import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Order, ActivityLog, UserSession, MirrorSyncState, MirrorDevice } from '../types';

interface UseMirrorSyncProps {
  session: UserSession;
  onOrderUpdated?: (order: Order) => void;
  onOrderCreated?: (order: Order) => void;
  onOrderDeleted?: (orderId: string) => void;
  onActivityLogged?: (activity: ActivityLog) => void;
  onTelegramEvent?: (data: any) => void;
  onDataRefreshNeeded?: () => void;
}

export function useMirrorSync({
  session,
  onOrderUpdated,
  onOrderCreated,
  onOrderDeleted,
  onActivityLogged,
  onTelegramEvent,
  onDataRefreshNeeded,
}: UseMirrorSyncProps) {
  const [syncState, setSyncState] = useState<MirrorSyncState>({
    isConnected: false,
    deviceCount: 1,
    lastSyncAt: null,
    transport: 'disconnected',
    latencyMs: 18,
  });

  const [connectedDevices, setConnectedDevices] = useState<MirrorDevice[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // Keep callback refs fresh
  const onOrderUpdatedRef = useRef(onOrderUpdated);
  onOrderUpdatedRef.current = onOrderUpdated;
  const onOrderCreatedRef = useRef(onOrderCreated);
  onOrderCreatedRef.current = onOrderCreated;
  const onOrderDeletedRef = useRef(onOrderDeleted);
  onOrderDeletedRef.current = onOrderDeleted;
  const onActivityLoggedRef = useRef(onActivityLogged);
  onActivityLoggedRef.current = onActivityLogged;
  const onTelegramEventRef = useRef(onTelegramEvent);
  onTelegramEventRef.current = onTelegramEvent;
  const onDataRefreshNeededRef = useRef(onDataRefreshNeeded);
  onDataRefreshNeededRef.current = onDataRefreshNeeded;

  useEffect(() => {
    // Detect device type
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isTablet = /iPad|Tablet/i.test(navigator.userAgent);
    const deviceType: 'desktop' | 'mobile' | 'tablet' = isTablet
      ? 'tablet'
      : isMobile
      ? 'mobile'
      : 'desktop';

    // Connect to same origin
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      query: {
        role: session.role,
        name: session.name,
        deviceType,
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setSyncState((prev) => ({
        ...prev,
        isConnected: true,
        transport: socket.io.engine?.transport?.name === 'websocket' ? 'websocket' : 'polling',
        lastSyncAt: new Date().toISOString(),
      }));

      // Announce device presence
      socket.emit('mirror:device_join', {
        role: session.role,
        name: session.name,
        deviceType,
      });
    });

    socket.on('disconnect', (reason) => {
      setSyncState((prev) => ({
        ...prev,
        isConnected: false,
        transport: 'disconnected',
      }));
    });

    // Real-time Presence & Mirror stats
    socket.on('mirror:presence', (data: { count: number; devices: MirrorDevice[] }) => {
      setSyncState((prev) => ({
        ...prev,
        deviceCount: data.count || 1,
        lastSyncAt: new Date().toISOString(),
      }));
      if (Array.isArray(data.devices)) {
        setConnectedDevices(data.devices);
      }
    });

    // Order sync events (mirroring PC <-> Mobile <-> Telegram)
    socket.on('mirror:order_updated', (order: Order) => {
      setSyncState((prev) => ({ ...prev, lastSyncAt: new Date().toISOString() }));
      if (onOrderUpdatedRef.current) {
        onOrderUpdatedRef.current(order);
      }
    });

    socket.on('mirror:order_created', (order: Order) => {
      setSyncState((prev) => ({ ...prev, lastSyncAt: new Date().toISOString() }));
      if (onOrderCreatedRef.current) {
        onOrderCreatedRef.current(order);
      }
    });

    socket.on('mirror:order_deleted', (data: { id: string }) => {
      setSyncState((prev) => ({ ...prev, lastSyncAt: new Date().toISOString() }));
      if (onOrderDeletedRef.current) {
        onOrderDeletedRef.current(data.id);
      }
    });

    // System Activity log
    socket.on('mirror:activity_logged', (activity: ActivityLog) => {
      setSyncState((prev) => ({ ...prev, lastSyncAt: new Date().toISOString() }));
      if (onActivityLoggedRef.current) {
        onActivityLoggedRef.current(activity);
      }
    });

    // Telegram Bot incoming events
    socket.on('mirror:telegram_event', (data: any) => {
      setSyncState((prev) => ({ ...prev, lastSyncAt: new Date().toISOString() }));
      if (onTelegramEventRef.current) {
        onTelegramEventRef.current(data);
      }
      if (onDataRefreshNeededRef.current) {
        onDataRefreshNeededRef.current();
      }
    });

    // Measure latency periodically
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        const start = Date.now();
        socket.emit('mirror:ping', () => {
          const latency = Date.now() - start;
          setSyncState((prev) => ({ ...prev, latencyMs: latency }));
        });
      }
    }, 15000);

    return () => {
      clearInterval(pingInterval);
      socket.disconnect();
    };
  }, [session.role, session.name]);

  // Broadcast action from client to other mirrored screens
  const emitOrderUpdate = useCallback((order: Order) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('mirror:order_update', order);
    }
  }, []);

  const emitOrderCreate = useCallback((order: Order) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('mirror:order_create', order);
    }
  }, []);

  const forceSync = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('mirror:request_sync');
    }
    if (onDataRefreshNeededRef.current) {
      onDataRefreshNeededRef.current();
    }
  }, []);

  return {
    syncState,
    connectedDevices,
    emitOrderUpdate,
    emitOrderCreate,
    forceSync,
  };
}
