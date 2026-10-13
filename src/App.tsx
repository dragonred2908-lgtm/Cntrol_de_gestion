import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from './components/AppLayout';
import { MainOrdersScreen } from './components/MainOrdersScreen';
import { CascadingWindowModal } from './components/CascadingWindowModal';
import { CascadeWindowType } from './components/CascadingMenu';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useMirrorSync } from './hooks/useMirrorSync';
import { AuthModal } from './components/AuthModal';
import { NewOrderModal } from './components/NewOrderModal';
import { ReminderModal } from './components/ReminderModal';
import { ExportModal } from './components/ExportModal';
import { useSSE } from './hooks/useSSE';
import { useDualPersistence } from './hooks/useDualPersistence';
import {
  Order,
  Member,
  ActivityLog,
  TelegramConfig,
  UserSession,
  OrderStatus,
  DeviceViewMode,
} from './types';

export default function App() {
  const [activeCascadeWindow, setActiveCascadeWindow] = useState<CascadeWindowType>(null);

  // Initialize with clean state (clearing legacy mock orders cache if present)
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const cached = localStorage.getItem('nucleo_orders_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Clear old mock seed orders if present
        if (Array.isArray(parsed) && parsed.some((o: any) => o.id === 'ORD-1001')) {
          localStorage.removeItem('nucleo_orders_cache');
          localStorage.removeItem('nucleo_activity_cache');
          return [];
        }
        return parsed;
      }
      return [];
    } catch {
      return [];
    }
  });

  const [members, setMembers] = useState<Member[]>(() => {
    try {
      const cached = localStorage.getItem('nucleo_members_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [activity, setActivity] = useState<ActivityLog[]>(() => {
    try {
      const cached = localStorage.getItem('nucleo_activity_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.some((a: any) => a.orderId === 'ORD-1001' || a.id === 'act-1')) {
          localStorage.removeItem('nucleo_activity_cache');
          return [];
        }
        return parsed;
      }
      return [];
    } catch {
      return [];
    }
  });

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => {
    try {
      const cached = localStorage.getItem('nucleo_tg_cache');
      if (cached) return JSON.parse(cached);
    } catch {}
    return {
      botToken: '',
      groupChatId: '',
      autoRemindersEnabled: true,
      autoReminderHoursBeforeDue: 12,
      status: 'simulated',
    };
  });

  const [session, setSession] = useState<UserSession>(() => {
    return {
      role: 'admin',
      name: 'Administrador de Gestión',
      authenticated: true,
    };
  });

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderSelectedOrder, setReminderSelectedOrder] = useState<Order | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // 💻📱 Detección Automática de Dispositivo (Móvil vs PC según resolución y viewport)
  const [viewDevice, setViewDevice] = useState<DeviceViewMode>(() => {
    return typeof window !== 'undefined' && window.innerWidth < 1024 ? 'mobile' : 'pc';
  });

  useEffect(() => {
    const handleResize = () => {
      setViewDevice(window.innerWidth < 1024 ? 'mobile' : 'pc');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSetViewDevice = (device: DeviceViewMode) => {
    setViewDevice(device);
  };

  // ⛶ Ancho Completo / Fluido vs Contenedor
  const [isFullWidth, setIsFullWidth] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('nucleo_full_width');
      if (cached !== null) return cached === 'true';
    } catch {}
    return true;
  });

  const handleToggleFullWidth = () => {
    setIsFullWidth((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('nucleo_full_width', String(next));
      } catch {}
      return next;
    });
  };

  // 📱 Simulación de marco celular (en caso de probar modo móvil en PC)
  const [mobileFramePreview, setMobileFramePreview] = useState<boolean>(false);
  const handleToggleMobileFrame = () => {
    setMobileFramePreview((prev) => !prev);
  };

  // Resilient fetch helper with retry and exponential backoff
  const fetchData = useCallback(async () => {
    const fetchJson = async (url: string, retries = 2, delay = 600): Promise<any> => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            return await res.json();
          }
        } catch {
          if (attempt === retries) return null;
          await new Promise((r) => setTimeout(r, delay * (attempt + 1)));
        }
      }
      return null;
    };

    try {
      const [ordersData, membersData, actData, tgData] = await Promise.allSettled([
        fetchJson('/api/orders'),
        fetchJson('/api/members'),
        fetchJson('/api/activity'),
        fetchJson('/api/telegram/config'),
      ]);

      if (ordersData.status === 'fulfilled' && Array.isArray(ordersData.value)) {
        setOrders(ordersData.value);
        try { localStorage.setItem('nucleo_orders_cache', JSON.stringify(ordersData.value)); } catch {}
      }

      if (membersData.status === 'fulfilled' && Array.isArray(membersData.value)) {
        setMembers(membersData.value);
        try { localStorage.setItem('nucleo_members_cache', JSON.stringify(membersData.value)); } catch {}
      }

      if (actData.status === 'fulfilled' && Array.isArray(actData.value)) {
        setActivity(actData.value);
        try { localStorage.setItem('nucleo_activity_cache', JSON.stringify(actData.value)); } catch {}
      }

      if (tgData.status === 'fulfilled' && tgData.value && typeof tgData.value === 'object') {
        setTelegramConfig(tgData.value);
        try { localStorage.setItem('nucleo_tg_cache', JSON.stringify(tgData.value)); } catch {}
      }
    } catch {
      // Gracefully silent on transient background offline states
    } finally {
      setLoading(false);
    }
  }, []);

  // ⚡ Real-Time Multi-Device Mirror Sync Hook
  const { syncState, connectedDevices, forceSync } = useMirrorSync({
    session,
    onOrderUpdated: (updatedOrder) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
      );
    },
    onOrderCreated: (newOrder) => {
      setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
    },
    onOrderDeleted: (orderId) => {
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    },
    onActivityLogged: (newAct) => {
      setActivity((prev) => [newAct, ...prev.filter((a) => a.id !== newAct.id)]);
    },
    onDataRefreshNeeded: () => {
      fetchData();
    },
  });

  // ⚡ Canal SSE (Server-Sent Events) con Reconexión Automática y Heartbeat (20s)
  const {
    isConnected: sseConnected,
    lastHeartbeat: sseLastHeartbeat,
    clientsCount: sseClientsCount,
  } = useSSE({
    url: '/api/realtime/stream',
    onOrderCreated: (newOrder) => {
      setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
    },
    onOrderUpdated: (updatedOrder) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
      );
    },
    onOrderDeleted: (data) => {
      if (data?.id) {
        setOrders((prev) => prev.filter((o) => o.id !== data.id));
      }
    },
    onActivityLogged: (newAct) => {
      setActivity((prev) => [newAct, ...prev.filter((a) => a.id !== newAct.id)]);
    },
    onSyncBatchApplied: () => {
      fetchData();
    },
  });

  // 🔄 Persistencia Dual (Firestore Primaria + Local JSON Respaldo) y Cola FIFO
  const {
    fifoQueueLength,
    isFlushing: isFlushingQueue,
    flushQueue,
    enqueueSyncItem,
    persistenceStatus,
  } = useDualPersistence({
    onSyncCompleted: () => {
      fetchData();
    },
  });

  useEffect(() => {
    fetchData();

    // Secondary auto-refresh fallback
    const interval = setInterval(fetchData, 20000);

    const handleOnline = () => {
      fetchData();
      flushQueue();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchData, flushQueue]);

  // Order status update handler con persistencia dual y cola FIFO offline
  const handleUpdateStatus = async (
    orderId: string,
    status: OrderStatus,
    noteText?: string
  ) => {
    const nowIso = new Date().toISOString();

    // Actualización optimista inmediata en UI
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status,
              updatedAt: nowIso,
              completedAt: status === 'finalizada' ? nowIso : o.completedAt,
            }
          : o
      )
    );

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          noteText,
          noteAuthor: session.name,
          notifyTelegram: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e) {
      console.warn('Conexión no disponible. Encolando cambio en Cola FIFO Offline:', e);
      enqueueSyncItem({
        type: 'update_status',
        orderId,
        updatedAt: nowIso,
        payload: {
          status,
          noteText,
          noteAuthor: session.name,
        },
      });
    }
  };

  // Add observation / note
  const handleAddNote = async (orderId: string, noteText: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteText,
          noteAuthor: session.name,
          notifyTelegram: false,
        }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (e) {
      console.error('Error adding note:', e);
    }
  };

  // Delete order
  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm(`¿Está seguro de eliminar la orden #${orderId}?`)) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData();
      }
    } catch (e) {
      console.error('Error deleting order:', e);
    }
  };

  // Add new member
  const handleAddMember = async (memberData: Partial<Member>) => {
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberData),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (e) {
      console.error('Error adding member:', e);
    }
  };

  // Update Telegram Config
  const handleUpdateTelegramConfig = async (newConfig: Partial<TelegramConfig>) => {
    const res = await fetch('/api/telegram/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Error al guardar configuración');
    }
    await fetchData();
  };

  // Trigger automated reminder sweep
  const handleTriggerPendingReminders = async () => {
    const res = await fetch('/api/telegram/send-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType: 'all_pending' }),
    });
    if (!res.ok) throw new Error('Error al emitir recordatorios');
    await fetchData();
  };

  const handleOpenReminder = (order?: Order) => {
    setReminderSelectedOrder(order || null);
    setIsReminderModalOpen(true);
  };

  const pendingCount = orders.filter((o) => o.status !== 'finalizada').length;

  return (
    <>
      <AppLayout
        session={session}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenNewOrder={() => {
          if (session.role === 'operator') {
            setIsAuthModalOpen(true);
          } else {
            setIsNewOrderModalOpen(true);
          }
        }}
        onOpenReminder={() => handleOpenReminder()}
        onOpenExport={() => setIsExportModalOpen(true)}
        syncState={syncState}
        connectedDevices={connectedDevices}
        onForceSync={forceSync}
        pendingOrdersCount={pendingCount}
        totalOrdersCount={orders.length}
        telegramConfig={telegramConfig}
        sseConnected={sseConnected}
        sseLastHeartbeat={sseLastHeartbeat}
        sseClientsCount={sseClientsCount}
        fifoQueueLength={fifoQueueLength}
        onFlushQueue={flushQueue}
        isFlushingQueue={isFlushingQueue}
        viewDevice={viewDevice}
        onChangeViewDevice={handleSetViewDevice}
        isFullWidth={isFullWidth}
        onToggleFullWidth={handleToggleFullWidth}
        mobileFramePreview={mobileFramePreview}
        onToggleMobileFrame={handleToggleMobileFrame}
        onOpenCascadeWindow={(winType) => {
          if (winType === 'new-order') {
            setIsNewOrderModalOpen(true);
          } else if (winType === 'auth') {
            setIsAuthModalOpen(true);
          } else if (winType === 'reminder') {
            setIsReminderModalOpen(true);
          } else if (winType === 'export') {
            setIsExportModalOpen(true);
          } else {
            setActiveCascadeWindow(winType);
          }
        }}
      >
        {/* PANTALLA PRINCIPAL ÚNICA ADAPTATIVA: Órdenes Pendientes y Ejecutadas, Porcentaje General y Crear Orden */}
        <MainOrdersScreen
          orders={orders}
          members={members}
          session={session}
          viewDevice={viewDevice}
          onOpenNewOrder={() => {
            if (session.role === 'operator') {
              setIsAuthModalOpen(true);
            } else {
              setIsNewOrderModalOpen(true);
            }
          }}
          onOpenReminder={handleOpenReminder}
          onUpdateStatus={handleUpdateStatus}
          onDeleteOrder={handleDeleteOrder}
          onAddNote={handleAddNote}
          onRefreshData={fetchData}
        />
      </AppLayout>

      {/* Ventana Flotante en Cascada para Módulos Secundarios */}
      {activeCascadeWindow && (
        <CascadingWindowModal
          windowType={activeCascadeWindow}
          onClose={() => setActiveCascadeWindow(null)}
          orders={orders}
          members={members}
          activity={activity}
          telegramConfig={telegramConfig}
          session={session}
          syncState={syncState}
          connectedDevices={connectedDevices}
          onForceSync={forceSync}
          sseConnected={sseConnected}
          sseLastHeartbeat={sseLastHeartbeat}
          fifoQueueLength={fifoQueueLength}
          onFlushQueue={flushQueue}
          isFlushingQueue={isFlushingQueue}
          viewDevice={viewDevice}
          onAddMember={handleAddMember}
          onUpdateTelegramConfig={handleUpdateTelegramConfig}
          onTriggerPendingReminders={handleTriggerPendingReminders}
          onRefreshData={fetchData}
          onOpenReminderModal={(ord, mem) => handleOpenReminder(ord)}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
        />
      )}

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        session={session}
        onLoginSuccess={(newSession) => setSession(newSession)}
      />

      <NewOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        members={members}
        onOrderCreated={fetchData}
      />

      <ReminderModal
        isOpen={isReminderModalOpen}
        onClose={() => {
          setIsReminderModalOpen(false);
          setReminderSelectedOrder(null);
        }}
        members={members}
        orders={orders}
        preselectedOrder={reminderSelectedOrder}
        onReminderSent={fetchData}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        orders={orders}
        members={members}
      />
    </>
  );
}
