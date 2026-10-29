import { useState, useEffect, useCallback } from 'react';
import { syncQueue, SyncQueueItem, FlushResult } from '../services/syncQueue';
import { getToken } from '../lib/api';

export interface DualPersistenceStatus {
  primary: 'firestore';
  primaryStatus: 'connected' | 'standby' | 'simulated';
  backup: 'local_json';
  backupStatus: 'active';
  backupFile: string;
  pendingSyncCount: number;
  lastSyncAt: string | null;
  conflictResolutionStrategy: string;
}

export interface UseDualPersistenceOptions {
  onSyncCompleted?: (appliedCount: number) => void;
}

export function useDualPersistence(options: UseDualPersistenceOptions = {}) {
  const { onSyncCompleted } = options;
  const [queue, setQueue] = useState<SyncQueueItem[]>([]);
  const [isFlushing, setIsFlushing] = useState(false);
  const [lastFlushResult, setLastFlushResult] = useState<FlushResult | null>(null);
  const [serverStatus, setServerStatus] = useState<DualPersistenceStatus | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Subscribe to FIFO queue updates
  useEffect(() => {
    const unsubscribe = syncQueue.subscribe((items) => {
      setQueue(items);
    });
    return unsubscribe;
  }, []);

  // Fetch persistence status from server
  const fetchStatus = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch('/api/persistence/status', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        setServerStatus(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Flush trigger
  const flushQueue = useCallback(async () => {
    if (isFlushing) return;
    setIsFlushing(true);
    try {
      const result = await syncQueue.flush();
      if (result) {
        setLastFlushResult(result);
        await fetchStatus();
        if (result.applied > 0) {
          onSyncCompleted?.(result.applied);
        }
      }
    } finally {
      setIsFlushing(false);
    }
  }, [isFlushing, fetchStatus, onSyncCompleted]);

  // Auto-flush on browser online event
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[useDualPersistence] Conexión online detectada, despachando cola FIFO...');
      flushQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushQueue]);

  return {
    queue,
    queueLength: queue.length,
    fifoQueueLength: queue.length,
    isFlushing,
    lastFlushResult,
    serverStatus,
    persistenceStatus: serverStatus,
    isOnline,
    flushQueue,
    enqueue: syncQueue.enqueue.bind(syncQueue),
    enqueueSyncItem: syncQueue.enqueue.bind(syncQueue),
    clearQueue: syncQueue.clear.bind(syncQueue),
    fetchStatus,
  };
}
