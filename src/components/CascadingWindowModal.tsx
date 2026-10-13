import React, { useEffect } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  Users,
  Send,
  Terminal,
  Sparkles,
  Activity,
  Radio,
  Shield,
  Layers,
  ChevronLeft,
} from 'lucide-react';
import { CascadeWindowType } from './CascadingMenu';
import {
  Order,
  Member,
  ActivityLog,
  TelegramConfig,
  UserSession,
  MirrorSyncState,
  MirrorDevice,
  DeviceViewMode,
} from '../types';
import { ProfessionalsView } from './ProfessionalsView';
import { TelegramView } from './TelegramView';
import { TelegramSimulator } from './TelegramSimulator';
import { KpiAiAnalysisPanel } from './KpiAiAnalysisPanel';
import { ActivityLogView } from './ActivityLogView';
import { ProtectedRoute } from './ProtectedRoute';

interface CascadingWindowModalProps {
  windowType: CascadeWindowType;
  onClose: () => void;
  orders: Order[];
  members: Member[];
  activity: ActivityLog[];
  telegramConfig: TelegramConfig;
  session: UserSession;
  syncState: MirrorSyncState;
  connectedDevices: MirrorDevice[];
  onForceSync: () => void;
  sseConnected?: boolean;
  sseLastHeartbeat?: string | null;
  fifoQueueLength?: number;
  onFlushQueue?: () => void;
  isFlushingQueue?: boolean;
  viewDevice?: DeviceViewMode;
  onAddMember: (member: Omit<Member, 'id'>) => Promise<void>;
  onUpdateTelegramConfig: (config: Partial<TelegramConfig>) => Promise<void>;
  onTriggerPendingReminders: () => Promise<void>;
  onRefreshData: () => Promise<void>;
  onOpenReminderModal: (order?: Order, member?: Member) => void;
  onOpenAuthModal: () => void;
}

export const CascadingWindowModal: React.FC<CascadingWindowModalProps> = ({
  windowType,
  onClose,
  orders,
  members,
  activity,
  telegramConfig,
  session,
  syncState,
  connectedDevices,
  onForceSync,
  sseConnected = true,
  sseLastHeartbeat = null,
  fifoQueueLength = 0,
  onFlushQueue,
  isFlushingQueue = false,
  viewDevice = 'pc',
  onAddMember,
  onUpdateTelegramConfig,
  onTriggerPendingReminders,
  onRefreshData,
  onOpenReminderModal,
  onOpenAuthModal,
}) => {
  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!windowType) return null;

  // Window title and icon
  const getWindowHeader = () => {
    switch (windowType) {
      case 'professionals':
        return {
          title: 'Equipo & Especialistas',
          subtitle: 'Directorio de miembros, carga operativa y rendimiento individual',
          icon: <Users className="w-5 h-5 text-[#60a5fa]" />,
          badge: `${members.length} Especialistas`,
        };
      case 'telegram':
        return {
          title: 'Canal Telegram & Automatización',
          subtitle: 'Configuración del Bot interactivo, Webhook y notificaciones push',
          icon: <Send className="w-5 h-5 text-[#229ed9]" />,
          badge: telegramConfig.status === 'connected' ? 'En Línea' : 'Simulador',
        };
      case 'simulator':
        return {
          title: 'Consola Bot & Debug (DEV)',
          subtitle: 'Simulador bidireccional de comandos Telegram y webhook en vivo',
          icon: <Terminal className="w-5 h-5 text-[#a5b4fc]" />,
          badge: 'Consola Interactiva',
        };
      case 'kpi':
        return {
          title: 'Diagnóstico IA de Rendimiento (KPIs)',
          subtitle: 'Auditoría automática con Gemini 3.8 y matriz de acciones correctivas',
          icon: <Sparkles className="w-5 h-5 text-[#c084fc]" />,
          badge: 'Gemini 3.8 Flash',
        };
      case 'activity':
        return {
          title: 'Registro de Actividad & Logs',
          subtitle: 'Historial cronológico de cambios, alertas y eventos del sistema',
          icon: <Activity className="w-5 h-5 text-[#34d399]" />,
          badge: `${activity.length} Eventos`,
        };
      case 'telemetry':
        return {
          title: 'Telemetría del Sistema & Conectividad',
          subtitle: 'Estado en vivo de Sockets, Server-Sent Events (SSE) y Persistencia Dual',
          icon: <Radio className="w-5 h-5 text-[#38bdf8]" />,
          badge: syncState.isConnected ? 'Sincronizado' : 'Offline',
        };
      default:
        return {
          title: 'Módulo de Gestión',
          subtitle: 'Ventana secundaria del sistema',
          icon: <Layers className="w-5 h-5 text-[#4d8eff]" />,
          badge: 'Núcleo',
        };
    }
  };

  const header = getWindowHeader();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 overflow-hidden">
      {/* Backdrop con desenfoque suave */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Ventana Flotante / Modal Cascada */}
      <div className="relative w-full max-w-6xl max-h-[92vh] bg-[#10141e] border border-[#2b303e] rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200 ring-1 ring-white/10">
        {/* Barra Superior de la Ventana */}
        <div className="h-16 px-4 sm:px-6 bg-[#161a25] border-b border-[#232732] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-[#202636] hover:bg-[#2b3347] text-[#c2c6d6] hover:text-white transition flex items-center gap-1 text-xs font-medium cursor-pointer"
              title="Volver a la pantalla principal"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Pantalla Principal</span>
            </button>

            <div className="h-5 w-px bg-[#2b303e]" />

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#0a0e16] border border-[#2b303e]">
                {header.icon}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-[#dfe2ee] leading-tight">
                    {header.title}
                  </h2>
                  <span className="font-mono text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-[#1e2330] text-[#adc6ff] border border-[#2b303e]">
                    {header.badge}
                  </span>
                </div>
                <p className="text-[11px] text-[#8c909f] leading-tight hidden sm:block">
                  {header.subtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Botones de Control de la Ventana */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#202636] hover:bg-[#ef4444]/20 hover:text-[#ef4444] border border-[#2b303e] text-[#dfe2ee] text-xs font-semibold transition cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar Ventana</span>
            </button>
          </div>
        </div>

        {/* Contenido Dinámico de la Ventana Secundaría */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0c1017]">
          {windowType === 'professionals' && (
            <ProfessionalsView
              members={members}
              orders={orders}
              session={session}
              onAddMember={onAddMember}
              onOpenReminder={(ord, mem) => onOpenReminderModal(ord, mem)}
              onFilterOrdersByMember={() => {
                onClose();
              }}
            />
          )}

          {windowType === 'telegram' && (
            <TelegramView
              config={telegramConfig}
              session={session}
              onUpdateConfig={onUpdateTelegramConfig}
              onTriggerPendingReminders={onTriggerPendingReminders}
              onNavigateToSimulator={() => {
                // switch to simulator within window
              }}
            />
          )}

          {windowType === 'simulator' && (
            <ProtectedRoute
              session={session}
              requiredPermission="access_dev_tools"
              onRequestAuth={onOpenAuthModal}
            >
              <TelegramSimulator
                orders={orders}
                members={members}
                onOrderUpdatedFromTelegram={onRefreshData}
              />
            </ProtectedRoute>
          )}

          {windowType === 'kpi' && (
            <KpiAiAnalysisPanel
              orders={orders}
              members={members}
              onCreateOrderFromAction={() => {
                onClose();
              }}
            />
          )}

          {windowType === 'activity' && (
            <ActivityLogView activities={activity} onRefresh={onRefreshData} />
          )}

          {windowType === 'telemetry' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="bg-[#141822] border border-[#2b303e] rounded-2xl p-6 space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-[#232732]">
                  <div className="flex items-center gap-2">
                    <Radio className="w-5 h-5 text-[#38bdf8]" />
                    <span className="text-sm font-bold text-white font-sans">
                      Panel de Telemetría y Salud del Sistema
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onForceSync}
                    className="px-3 py-1.5 rounded-xl bg-[#005ac2] hover:bg-[#00489d] text-white text-xs font-sans font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>Forzar Sincronización</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-[#0d111a] border border-[#232732] space-y-1.5">
                    <span className="text-[#8c909f] text-[11px] block">1. Espejo Socket.io</span>
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          syncState.isConnected ? 'bg-[#34d399]' : 'bg-[#ef4444]'
                        }`}
                      />
                      <span>{syncState.isConnected ? 'Conectado (En Vivo)' : 'Desconectado'}</span>
                    </div>
                    <span className="text-[10px] text-[#717686]">
                      Latencia: {syncState.latencyMs || 15} ms
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0d111a] border border-[#232732] space-y-1.5">
                    <span className="text-[#8c909f] text-[11px] block">2. Canal SSE Stream</span>
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          sseConnected ? 'bg-cyan-400' : 'bg-amber-400'
                        }`}
                      />
                      <span>{sseConnected ? 'Activo (Heartbeat 20s)' : 'Reconectando...'}</span>
                    </div>
                    <span className="text-[10px] text-[#717686]">
                      Último latido: {sseLastHeartbeat || 'Reciente'}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0d111a] border border-[#232732] space-y-1.5">
                    <span className="text-[#8c909f] text-[11px] block">3. Persistencia Dual</span>
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          fifoQueueLength > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                        }`}
                      />
                      <span>Firestore + JSON Local</span>
                    </div>
                    <span className="text-[10px] text-[#717686]">
                      Cola Offline: {fifoQueueLength} operaciones
                    </span>
                  </div>
                </div>

                {fifoQueueLength > 0 && onFlushQueue && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                    <div>
                      <span className="text-amber-300 font-bold block">
                        Hay {fifoQueueLength} cambios locales esperando sincronización
                      </span>
                      <span className="text-amber-200/70 text-[11px]">
                        Se subirán automáticamente al recuperar conexión.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={onFlushQueue}
                      disabled={isFlushingQueue}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg cursor-pointer transition"
                    >
                      {isFlushingQueue ? 'Sincronizando...' : 'Subir Ahora'}
                    </button>
                  </div>
                )}

                <div className="pt-4 border-t border-[#232732]">
                  <h4 className="text-xs text-[#dfe2ee] font-sans font-bold mb-2">
                    Dispositivos Conectados en Esta Red:
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {connectedDevices.length > 0 ? (
                      connectedDevices.map((dev, idx) => (
                        <div
                          key={dev.id || idx}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-[#0d111a] border border-[#232732]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{dev.name || 'Dispositivo'}</span>
                            <span className="text-[10px] text-[#8c909f] font-mono">
                              ({dev.deviceType})
                            </span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#1e2330] text-[#a5b4fc]">
                            {dev.role}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[#717686] text-xs italic">
                        1 terminal principal activa
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
