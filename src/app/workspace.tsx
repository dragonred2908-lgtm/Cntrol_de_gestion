import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityLog, Member, Order, OrderStatus, TelegramConfig, UserRole, UserSession } from '../types';
import { api, ApiError, CreateMemberInput, CreateOrderInput, MemberSyncResult, TelegramConfigResponse } from '../lib/api';
import { computeStats } from '../lib/helpers';
import { useMirrorSync } from '../hooks/useMirrorSync';
import { useSSE } from '../hooks/useSSE';
import { useDualPersistence } from '../hooks/useDualPersistence';
import { syncQueue } from '../services/syncQueue';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

interface WorkspaceValue {
  orders: Order[];
  members: Member[];
  activity: ActivityLog[];
  telegramConfig: TelegramConfigResponse;
  session: UserSession;
  loading: boolean;
  refreshing: boolean;
  stats: ReturnType<typeof computeStats>;

  /* realtime */
  socketConnected: boolean;
  sseConnected: boolean;
  sseClients: number;
  deviceCount: number;
  lastSyncAt: string | null;
  queueLength: number;
  flushing: boolean;

  /* actions */
  refresh: () => Promise<void>;
  createOrder: (input: CreateOrderInput) => Promise<Order>;
  setStatus: (orderId: string, status: OrderStatus, noteText?: string) => Promise<void>;
  addNote: (orderId: string, text: string) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  createMember: (input: CreateMemberInput) => Promise<Member>;
  syncMembers: () => Promise<MemberSyncResult>;
  saveTelegramConfig: (input: Partial<TelegramConfig>) => Promise<void>;
  verifyPin: (pin: string, role: UserRole) => Promise<void>;
  signOut: () => void;
  resetData: () => Promise<void>;
  flushQueue: () => Promise<void>;

  /* toasts */
  toasts: Toast[];
  pushToast: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: string) => void;
}

const DEFAULT_TELEGRAM: TelegramConfigResponse = {
  botToken: '',
  groupChatId: '',
  autoRemindersEnabled: true,
  autoReminderHoursBeforeDue: 12,
  status: 'simulated',
};

const DEFAULT_SESSION: UserSession = {
  role: 'admin',
  name: 'Administrador de Gestión',
  authenticated: true,
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

/* -------------------------------------------------------------------------- */
/* Local cache helpers                                                        */
/* -------------------------------------------------------------------------- */

function readCache<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — ignore */
  }
}

/* -------------------------------------------------------------------------- */
/* Provider                                                                   */
/* -------------------------------------------------------------------------- */

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(() => readCache<Order[]>('nucleo_orders_cache', []));
  const [members, setMembers] = useState<Member[]>(() => readCache<Member[]>('nucleo_members_cache', []));
  const [activity, setActivity] = useState<ActivityLog[]>(() => readCache<ActivityLog[]>('nucleo_activity_cache', []));
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfigResponse>(() =>
    readCache<TelegramConfigResponse>('nucleo_tg_cache', DEFAULT_TELEGRAM),
  );
  const [session, setSession] = useState<UserSession>(() =>
    // Sin token no hay sesión: evita mostrar la consola con datos cacheados.
    api.getToken() ? readCache<UserSession>('nucleo_session_v2', DEFAULT_SESSION) : DEFAULT_SESSION,
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const pushToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4800);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  /* ------------------------------------------------------------------ */
  /* Fetching                                                            */
  /* ------------------------------------------------------------------ */

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const [ordersResult, membersResult, activityResult, telegramResult] = await Promise.allSettled([
      api.orders.list(),
      api.members.list(),
      api.activity.list(150),
      api.telegram.getConfig(),
    ]);

    if (!mounted.current) return;

    if (ordersResult.status === 'fulfilled') {
      setOrders(ordersResult.value);
      writeCache('nucleo_orders_cache', ordersResult.value);
    }
    if (membersResult.status === 'fulfilled') {
      setMembers(membersResult.value);
      writeCache('nucleo_members_cache', membersResult.value);
    }
    if (activityResult.status === 'fulfilled') {
      setActivity(activityResult.value);
      writeCache('nucleo_activity_cache', activityResult.value);
    }
    if (telegramResult.status === 'fulfilled') {
      setTelegramConfig(telegramResult.value);
      writeCache('nucleo_tg_cache', telegramResult.value);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  /* ------------------------------------------------------------------ */
  /* Realtime                                                            */
  /* ------------------------------------------------------------------ */

  const upsertOrder = useCallback((incoming: Order) => {
    setOrders((prev) => {
      const exists = prev.some((order) => order.id === incoming.id);
      const next = exists ? prev.map((order) => (order.id === incoming.id ? incoming : order)) : [incoming, ...prev];
      writeCache('nucleo_orders_cache', next);
      return next;
    });
  }, []);

  const removeOrder = useCallback((orderId: string) => {
    setOrders((prev) => {
      const next = prev.filter((order) => order.id !== orderId);
      writeCache('nucleo_orders_cache', next);
      return next;
    });
  }, []);

  const appendActivity = useCallback((log: ActivityLog) => {
    setActivity((prev) => {
      if (prev.some((item) => item.id === log.id)) return prev;
      const next = [log, ...prev].slice(0, 150);
      writeCache('nucleo_activity_cache', next);
      return next;
    });
  }, []);

  const { syncState, connectedDevices } = useMirrorSync({
    session,
    onOrderUpdated: upsertOrder,
    onOrderCreated: upsertOrder,
    onOrderDeleted: removeOrder,
    onActivityLogged: appendActivity,
    onDataRefreshNeeded: refresh,
  });

  const {
    isConnected: sseConnected,
    clientsCount: sseClients,
  } = useSSE({
    url: '/api/realtime/stream',
    onOrderCreated: upsertOrder,
    onOrderUpdated: upsertOrder,
    onOrderDeleted: (data: { id?: string }) => {
      if (data?.id) removeOrder(data.id);
    },
    onActivityLogged: appendActivity,
    onMembersUpdated: (data: { members?: Member[] }) => {
      if (Array.isArray(data?.members)) {
        setMembers(data.members);
        writeCache('nucleo_members_cache', data.members);
      }
    },
    onSyncBatchApplied: () => {
      void refresh();
    },
  });

  const { fifoQueueLength, isFlushing, flushQueue } = useDualPersistence({
    onSyncCompleted: () => {
      void refresh();
      pushToast('Cambios pendientes sincronizados con el servidor.', 'success');
    },
  });

  const flushQueueRef = useRef(flushQueue);
  flushQueueRef.current = flushQueue;

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);

    const onOnline = () => {
      void refresh();
      void flushQueueRef.current();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  /* ------------------------------------------------------------------ */
  /* Mutations                                                           */
  /* ------------------------------------------------------------------ */

  const createOrder = useCallback(
    async (input: CreateOrderInput) => {
      const order = await api.orders.create(input);
      upsertOrder(order);
      pushToast(`Orden ${order.id} creada y despachada.`, 'success');
      void refresh();
      return order;
    },
    [pushToast, refresh, upsertOrder],
  );

  const setStatus = useCallback(
    async (orderId: string, status: OrderStatus, noteText?: string) => {
      const current = orders.find((order) => order.id === orderId);
      if (!current) return;
      const now = new Date().toISOString();
      const optimistic: Order = {
        ...current,
        status,
        updatedAt: now,
        completedAt: status === 'finalizada' ? now : current.completedAt,
      };
      upsertOrder(optimistic);

      try {
        const saved = await api.orders.setStatus(orderId, status, session.name, noteText);
        upsertOrder(saved);
        pushToast(`Orden ${orderId} → ${status.replace('_', ' ')}.`, 'success');
      } catch (error) {
        if (error instanceof ApiError && error.status === 0) {
          syncQueue.enqueue('orders', 'status_change', orderId, optimistic, now);
          pushToast('Sin conexión: el cambio quedó en la cola y se enviará al reconectar.', 'warning');
          return;
        }
        upsertOrder(current);
        pushToast(error instanceof Error ? error.message : 'No se pudo actualizar la orden.', 'error');
      }
    },
    [orders, pushToast, session.name, upsertOrder],
  );

  const addNote = useCallback(
    async (orderId: string, text: string) => {
      await api.orders.addNote(orderId, text, session.name);
      await refresh();
      pushToast('Nota agregada a la orden.', 'success');
    },
    [pushToast, refresh, session.name],
  );

  const deleteOrder = useCallback(
    async (orderId: string) => {
      await api.orders.remove(orderId);
      removeOrder(orderId);
      pushToast(`Orden ${orderId} eliminada.`, 'info');
    },
    [pushToast, removeOrder],
  );

  const createMember = useCallback(
    async (input: CreateMemberInput) => {
      const member = await api.members.create(input);
      setMembers((prev) => [...prev, member]);
      pushToast(`${member.name} se sumó al equipo.`, 'success');
      return member;
    },
    [pushToast],
  );

  const syncMembers = useCallback(async () => {
    const summary = await api.telegram.syncMembers(session.name);
    await refresh();
    pushToast(
      `Integrantes actualizados: ${summary.created} nuevos, ${summary.updated} actualizados.`,
      'success',
    );
    return summary;
  }, [pushToast, refresh, session.name]);

  const saveTelegramConfig = useCallback(
    async (input: Partial<TelegramConfig>) => {
      const updated = await api.telegram.saveConfig(input);
      setTelegramConfig(updated);
      writeCache('nucleo_tg_cache', updated);
      pushToast('Configuración de Telegram guardada.', 'success');
    },
    [pushToast],
  );

  const verifyPin = useCallback(
    async (pin: string, role: UserRole) => {
      const result = await api.auth.verify(pin, role);
      api.setToken(result.token);
      try {
        sessionStorage.removeItem('nucleo_relogin');
      } catch {
        /* noop */
      }
      const nextSession: UserSession = {
        role: result.role,
        name: result.name,
        authenticated: true,
      };
      setSession(nextSession);
      writeCache('nucleo_session_v2', nextSession);
      pushToast(`Sesión iniciada como ${result.name}.`, 'success');
    },
    [pushToast],
  );

  const signOut = useCallback(() => {
    api.auth.logout();
    const next: UserSession = { role: 'viewer', name: 'Invitado', authenticated: false };
    setSession(next);
    writeCache('nucleo_session_v2', next);
  }, []);

  const resetData = useCallback(async () => {
    await api.resetData();
    await refresh();
    pushToast('Datos restaurados a los valores iniciales.', 'warning');
  }, [pushToast, refresh]);

  /* ------------------------------------------------------------------ */
  /* Derived                                                             */
  /* ------------------------------------------------------------------ */

  const stats = useMemo(() => computeStats(orders), [orders]);

  const value: WorkspaceValue = {
    orders,
    members,
    activity,
    telegramConfig,
    session,
    loading,
    refreshing,
    stats,
    socketConnected: syncState.isConnected,
    sseConnected,
    sseClients,
    deviceCount: syncState.deviceCount || connectedDevices.length || 1,
    lastSyncAt: syncState.lastSyncAt,
    queueLength: fifoQueueLength,
    flushing: isFlushing,
    refresh,
    createOrder,
    setStatus,
    addNote,
    deleteOrder,
    createMember,
    syncMembers,
    saveTelegramConfig,
    verifyPin,
    signOut,
    resetData,
    flushQueue,
    toasts,
    pushToast,
    dismissToast,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace debe usarse dentro de <WorkspaceProvider>');
  return context;
}

export { ApiError };
