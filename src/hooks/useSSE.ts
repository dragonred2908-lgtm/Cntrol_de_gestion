import { useState, useEffect, useRef, useCallback } from 'react';

export interface SSEHeartbeat {
  type: 'heartbeat';
  timestamp: string;
  clientsCount: number;
  uptime: number;
}

export interface UseSSEOptions {
  url?: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  onHeartbeat?: (heartbeat: SSEHeartbeat) => void;
  onOrderCreated?: (order: any) => void;
  onOrderUpdated?: (order: any) => void;
  onOrderDeleted?: (data: any) => void;
  onActivityLogged?: (log: any) => void;
  onTelegramEvent?: (event: any) => void;
  onSyncBatchApplied?: (result: any) => void;
  onKpiAnalysis?: (kpi: any) => void;
  onReconnectSuccess?: () => void;
}

export function useSSE(options: UseSSEOptions = {}) {
  const {
    url = '/api/realtime/stream',
    autoReconnect = true,
    maxReconnectAttempts = 20,
    onHeartbeat,
    onOrderCreated,
    onOrderUpdated,
    onOrderDeleted,
    onActivityLogged,
    onTelegramEvent,
    onSyncBatchApplied,
    onKpiAnalysis,
    onReconnectSuccess,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [activeClientsCount, setActiveClientsCount] = useState<number>(1);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManuallyClosedRef = useRef(false);
  const attemptsRef = useRef(0);

  // Keep latest callbacks in refs to avoid re-subscribing on each render
  const callbacksRef = useRef({
    onHeartbeat,
    onOrderCreated,
    onOrderUpdated,
    onOrderDeleted,
    onActivityLogged,
    onTelegramEvent,
    onSyncBatchApplied,
    onKpiAnalysis,
    onReconnectSuccess,
  });

  useEffect(() => {
    callbacksRef.current = {
      onHeartbeat,
      onOrderCreated,
      onOrderUpdated,
      onOrderDeleted,
      onActivityLogged,
      onTelegramEvent,
      onSyncBatchApplied,
      onKpiAnalysis,
      onReconnectSuccess,
    };
  }, [
    onHeartbeat,
    onOrderCreated,
    onOrderUpdated,
    onOrderDeleted,
    onActivityLogged,
    onTelegramEvent,
    onSyncBatchApplied,
    onKpiAnalysis,
    onReconnectSuccess,
  ]);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch {}
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      console.log(`[useSSE] Conectando a canal de eventos en tiempo real: ${url}...`);
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        console.log('[useSSE] Canal SSE establecido exitosamente.');
        setIsConnected(true);
        setConnectionError(null);
        if (attemptsRef.current > 0) {
          callbacksRef.current.onReconnectSuccess?.();
        }
        attemptsRef.current = 0;
        setReconnectCount(0);
      };

      // 1. Connected handshake
      es.addEventListener('connected', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.activeClientsCount) {
            setActiveClientsCount(data.activeClientsCount);
          }
        } catch {}
      });

      // 2. Heartbeat every 20 seconds
      es.addEventListener('heartbeat', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as SSEHeartbeat;
          setLastHeartbeat(data.timestamp);
          if (data.clientsCount) setActiveClientsCount(data.clientsCount);
          callbacksRef.current.onHeartbeat?.(data);
        } catch {}
      });

      // 3. Order Created
      es.addEventListener('order_created', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          callbacksRef.current.onOrderCreated?.(data);
        } catch {}
      });

      // 4. Order Updated / Status Change
      es.addEventListener('order_updated', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          callbacksRef.current.onOrderUpdated?.(data);
        } catch {}
      });

      // 4b. Order Deleted
      es.addEventListener('order_deleted', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          callbacksRef.current.onOrderDeleted?.(data);
        } catch {}
      });

      // 5. Activity Logged
      es.addEventListener('activity_logged', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          callbacksRef.current.onActivityLogged?.(data);
        } catch {}
      });

      // 6. Telegram Event
      es.addEventListener('telegram_event', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          callbacksRef.current.onTelegramEvent?.(data);
        } catch {}
      });

      // 7. Sync Batch Applied
      es.addEventListener('sync_batch_applied', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          callbacksRef.current.onSyncBatchApplied?.(data);
        } catch {}
      });

      // 8. KPI Analysis
      es.addEventListener('kpi_analysis', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          callbacksRef.current.onKpiAnalysis?.(data);
        } catch {}
      });

      es.onerror = () => {
        setIsConnected(false);
        setConnectionError('Conexión con canal SSE interrumpida. Reintentando...');
        es.close();
        eventSourceRef.current = null;

        if (!isManuallyClosedRef.current && autoReconnect) {
          attemptsRef.current += 1;
          setReconnectCount(attemptsRef.current);

          if (attemptsRef.current <= maxReconnectAttempts) {
            // Exponential backoff with ceiling at 15s
            const delay = Math.min(15000, 1000 * Math.pow(1.3, attemptsRef.current));
            console.log(`[useSSE] Reconectando en ${(delay / 1000).toFixed(1)}s (intento ${attemptsRef.current})...`);
            reconnectTimeoutRef.current = setTimeout(connect, delay);
          } else {
            setConnectionError('Se alcanzó el límite de intentos de reconexión SSE.');
          }
        }
      };
    } catch (err: any) {
      setIsConnected(false);
      setConnectionError(err.message || 'Error inicializando EventSource');
    }
  }, [url, autoReconnect, maxReconnectAttempts]);

  useEffect(() => {
    isManuallyClosedRef.current = false;
    connect();

    // Reconnect on tab focus or when network comes online
    const handleOnline = () => {
      console.log('[useSSE] Red detectada online. Re-sincronizando canal SSE...');
      attemptsRef.current = 0;
      connect();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !isConnected) {
        connect();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isManuallyClosedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [connect, isConnected]);

  const manualReconnect = useCallback(() => {
    attemptsRef.current = 0;
    connect();
  }, [connect]);

  return {
    isConnected,
    lastHeartbeat,
    reconnectCount,
    connectionError,
    activeClientsCount,
    clientsCount: activeClientsCount,
    reconnect: manualReconnect,
  };
}
