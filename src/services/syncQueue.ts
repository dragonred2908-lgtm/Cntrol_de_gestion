export interface SyncQueueItem<T = any> {
  id: string; // unique item id in queue
  entity: 'orders' | 'members' | 'activity' | 'telegramConfig';
  action: 'create' | 'update' | 'delete' | 'status_change';
  entityId: string;
  payload: T;
  timestamp: number; // enqueue epoch ms (ensures strict FIFO ordering)
  updatedAt: string; // ISO string used for Last-Write-Wins conflict resolution
  retries: number;
}

export interface FlushResult {
  totalReceived: number;
  applied: number;
  conflictsSkipped: number;
  results: Array<{ id: string; applied: boolean; reason: string }>;
}

import { getToken } from '../lib/api';

const STORAGE_KEY = 'nucleo_sync_queue_fifo';

class SyncQueueService {
  private isSyncing = false;
  private listeners: Array<(items: SyncQueueItem[]) => void> = [];

  constructor() {
    // Listen to window storage events across tabs/windows
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.notify();
        }
      });
    }
  }

  public getQueue(): SyncQueueItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Enforce strict FIFO sort by timestamp ascending
        return parsed.sort((a, b) => a.timestamp - b.timestamp);
      }
    } catch (e) {
      console.error('[SyncQueue] Error leyendo cola de almacenamiento:', e);
    }
    return [];
  }

  private saveQueue(items: SyncQueueItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      this.notify();
    } catch (e) {
      console.error('[SyncQueue] Error guardando cola en almacenamiento:', e);
    }
  }

  public enqueue<T>(
    entity: SyncQueueItem['entity'],
    action: SyncQueueItem['action'],
    entityId: string,
    payload: T,
    updatedAt?: string
  ): SyncQueueItem<T> {
    const queue = this.getQueue();
    const item: SyncQueueItem<T> = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      entity,
      action,
      entityId,
      payload,
      timestamp: Date.now(),
      updatedAt: updatedAt || new Date().toISOString(),
      retries: 0,
    };

    queue.push(item);
    this.saveQueue(queue);
    console.log(`[SyncQueue FIFO] Elemento encolado: ${entity}:${action}:${entityId}. Total en cola: ${queue.length}`);
    return item;
  }

  public remove(id: string): void {
    const queue = this.getQueue().filter((item) => item.id !== id);
    this.saveQueue(queue);
  }

  public clear(): void {
    this.saveQueue([]);
  }

  public subscribe(callback: (items: SyncQueueItem[]) => void): () => void {
    this.listeners.push(callback);
    callback(this.getQueue());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notify(): void {
    const q = this.getQueue();
    for (const l of this.listeners) {
      try {
        l(q);
      } catch {}
    }
  }

  /**
   * Flushes queue to server in strict FIFO order
   */
  public async flush(): Promise<FlushResult | null> {
    if (this.isSyncing) {
      console.log('[SyncQueue FIFO] Sincronización en curso, omitiendo ejecución redundante.');
      return null;
    }

    const items = this.getQueue();
    if (items.length === 0) {
      return { totalReceived: 0, applied: 0, conflictsSkipped: 0, results: [] };
    }

    this.isSyncing = true;
    console.log(`[SyncQueue FIFO] Iniciando subida de ${items.length} cambio(s) pendientes al servidor...`);

    try {
      const token = getToken();
      const response = await fetch('/api/sync/fifo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        throw new Error(`Servidor devolvió status ${response.status}`);
      }

      const data = (await response.json()) as FlushResult;

      // Upon successful batch processing, remove processed items from local queue
      const processedIds = new Set(data.results.map((r) => r.id));
      const remaining = this.getQueue().filter((item) => !processedIds.has(item.id));
      this.saveQueue(remaining);

      console.log(
        `[SyncQueue FIFO] Sincronización completada: ${data.applied} aplicados, ${data.conflictsSkipped} descartados por conflicto updatedAt. Restantes: ${remaining.length}`
      );

      return data;
    } catch (err: any) {
      console.warn('[SyncQueue FIFO] Error sincronizando con servidor (se mantendrán en cola para el próximo intento):', err.message);
      // Increment retries
      const updatedQueue = this.getQueue().map((item) => ({
        ...item,
        retries: item.retries + 1,
      }));
      this.saveQueue(updatedQueue);
      return null;
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncQueue = new SyncQueueService();
