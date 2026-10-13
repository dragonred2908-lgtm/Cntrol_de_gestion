import React, { useState, useEffect } from 'react';
import {
  Menu,
  X,
  Send,
  Plus,
  Bell,
  Download,
  Shield,
  Laptop,
  Smartphone,
  Tablet,
  Radio,
  RefreshCw,
  Clock,
  Layers,
  CheckCircle2,
  Users,
  Activity,
  Terminal,
  ExternalLink,
  Monitor,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { TabType } from './Sidebar';
import {
  UserSession,
  TelegramConfig,
  MirrorSyncState,
  MirrorDevice,
  DeviceViewMode,
} from '../types';
import { RBAC_MATRIX, hasPermission } from '../lib/rbacConfig';
import { CascadingMenu, CascadeWindowType } from './CascadingMenu';

interface AppLayoutProps {
  currentTab?: TabType;
  onChangeTab?: (tab: TabType) => void;
  session: UserSession;
  onOpenAuth: () => void;
  onOpenNewOrder: () => void;
  onOpenReminder: () => void;
  onOpenExport: () => void;
  syncState: MirrorSyncState;
  connectedDevices: MirrorDevice[];
  onForceSync: () => void;
  pendingOrdersCount: number;
  totalOrdersCount: number;
  telegramConfig: TelegramConfig;
  sseConnected?: boolean;
  sseLastHeartbeat?: string | null;
  sseClientsCount?: number;
  fifoQueueLength?: number;
  onFlushQueue?: () => void;
  isFlushingQueue?: boolean;
  viewDevice?: DeviceViewMode;
  onChangeViewDevice?: (device: DeviceViewMode) => void;
  isFullWidth?: boolean;
  onToggleFullWidth?: () => void;
  mobileFramePreview?: boolean;
  onToggleMobileFrame?: () => void;
  onOpenCascadeWindow: (windowType: CascadeWindowType) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  session,
  onOpenAuth,
  onOpenNewOrder,
  onOpenReminder,
  onOpenExport,
  syncState,
  connectedDevices,
  onForceSync,
  pendingOrdersCount,
  totalOrdersCount,
  telegramConfig,
  sseConnected = true,
  sseLastHeartbeat = null,
  sseClientsCount = 1,
  fifoQueueLength = 0,
  onFlushQueue,
  isFlushingQueue = false,
  viewDevice = 'pc',
  onChangeViewDevice,
  isFullWidth = true,
  onToggleFullWidth,
  mobileFramePreview = false,
  onToggleMobileFrame,
  onOpenCascadeWindow,
  children,
}) => {
  const [showMirrorDetails, setShowMirrorDetails] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const roleInfo = RBAC_MATRIX[session.role] || RBAC_MATRIX.admin;

  return (
    <div className="min-h-screen bg-[#090d15] text-[#c2c6d6] font-sans antialiased flex flex-col w-full max-w-full overflow-x-hidden selection:bg-[#4d8eff]/30 selection:text-white">
      {/* ============================================================== */}
      {/* ============================================================== */}
      {/* 1. TOP HEADER EN DOS LÍNEAS (SUPERIOR BRAND, INFERIOR MENÚS)   */}
      {/* ============================================================== */}
      <header className="fixed top-0 left-0 right-0 bg-[#11151f]/95 backdrop-blur-md z-40 border-b border-[#232732] shadow-md flex flex-col">
        {/* LÍNEA 1 (SUPERIOR): NOMBRE DE LA APP / BRANDING */}
        <div className="h-12 px-3 sm:px-5 lg:px-7 flex items-center justify-between border-b border-[#1f2432]/60 relative">
          {/* Lado Izquierdo: Vacío (sin isotipo NC) */}
          <div className="w-16 hidden sm:block z-10" />

          {/* Centro: Cuadro en degradado oscuro e iluminante con nombre de la app */}
          <div className="absolute inset-x-0 inset-y-0 flex items-center justify-center pointer-events-none px-4">
            <div className="relative px-4 sm:px-6 py-1 rounded-xl bg-gradient-to-r from-[#0a0e17] via-[#111a2d] to-[#0a0e17] border border-[#3b82f6]/50 shadow-[0_0_15px_rgba(59,130,246,0.3),inset_0_1px_1px_rgba(255,255,255,0.15)] flex items-center justify-center overflow-hidden">
              {/* Resplandor iluminante interior */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#3b82f6]/10 via-transparent to-transparent pointer-events-none" />

              <h1
                style={{ fontFamily: "'Montserrat', sans-serif" }}
                className="relative z-10 font-extrabold tracking-wider uppercase text-white whitespace-nowrap select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] flex items-baseline gap-2 text-xs sm:text-sm md:text-base"
              >
                {/* NÚCLEO: N 1 punto más grande */}
                <span className="inline-flex items-baseline">
                  <span className="text-sm sm:text-base md:text-lg font-black text-[#93c5fd] drop-shadow-[0_0_8px_rgba(147,197,253,0.6)]">
                    N
                  </span>
                  <span>ÚCLEO</span>
                </span>

                {/* CONTROL: C 1 punto más grande */}
                <span className="inline-flex items-baseline">
                  <span className="text-sm sm:text-base md:text-lg font-black text-[#93c5fd] drop-shadow-[0_0_8px_rgba(147,197,253,0.6)]">
                    C
                  </span>
                  <span>ONTROL</span>
                </span>
              </h1>
            </div>
          </div>

          {/* Lado Derecho: Reloj y Estado Operativo del Sistema */}
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#8c909f] z-10 ml-auto">
            <span className="text-[#dfe2ee] font-semibold hidden xs:inline">{currentTime}</span>
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" title="Sistema Operativo en Línea" />
          </div>
        </div>

        {/* LÍNEA 2 (INFERIOR): TODOS LOS DEMÁS MENÚS Y HERRAMIENTAS */}
        <div className="h-12 px-3 sm:px-5 lg:px-7 flex items-center justify-between gap-2 sm:gap-4 relative">
          {/* Lado Izquierdo: Menú Cascada de Módulos & Ventanas + Acciones Rápidas */}
          <div className="flex items-center gap-2">
            <CascadingMenu
              session={session}
              telegramConfig={telegramConfig}
              syncState={syncState}
              pendingOrdersCount={pendingOrdersCount}
              totalOrdersCount={totalOrdersCount}
              onOpenWindow={onOpenCascadeWindow}
              onOpenNewOrder={onOpenNewOrder}
            />

            {hasPermission(session.role, 'create_orders') && (
              <button
                type="button"
                onClick={onOpenNewOrder}
                className="flex items-center gap-1.5 bg-[#005ac2] hover:bg-[#00489d] text-white px-2.5 sm:px-3 py-1.5 rounded-xl font-bold text-xs shadow-md shadow-[#005ac2]/20 transition cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Nueva Orden</span>
              </button>
            )}

            {hasPermission(session.role, 'send_reminders') && (
              <button
                type="button"
                onClick={onOpenReminder}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#141822] hover:bg-[#1f2535] border border-[#2b303e] text-[#dfe2ee] text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                title="Despachar recordatorio por Telegram"
              >
                <Bell className="w-3.5 h-3.5 text-[#fbbf24]" />
                <span className="hidden sm:inline">Recordatorio</span>
              </button>
            )}

            {hasPermission(session.role, 'export_reports') && (
              <button
                type="button"
                onClick={onOpenExport}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#141822] hover:bg-[#1f2535] border border-[#2b303e] text-[#dfe2ee] text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 hidden md:flex"
                title="Exportar Reportes PDF/Excel"
              >
                <Download className="w-3.5 h-3.5 text-[#34d399]" />
                <span>Reportes</span>
              </button>
            )}
          </div>

          {/* Lado Derecho: Telemetría Live + Perfil de Usuario */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Telemetría Live Popover Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMirrorDetails(!showMirrorDetails)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#141822] hover:bg-[#1a202c] border border-[#2b303e] transition text-left cursor-pointer"
                title="Click para ver telemetría: Espejo, SSE y Persistencia Dual"
              >
                <div className="flex items-center gap-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      syncState.isConnected ? 'bg-[#34d399]' : 'bg-[#ef4444]'
                    }`}
                  />
                  <span
                    className={`w-2 h-2 rounded-full ${
                      sseConnected ? 'bg-cyan-400' : 'bg-amber-400'
                    }`}
                  />
                </div>
                <span className="font-mono text-[10px] text-[#dfe2ee] hidden sm:inline font-bold">
                  {syncState.isConnected ? 'Live' : 'Offline'}
                </span>
              </button>

              {/* Popover con detalles de telemetría */}
              {showMirrorDetails && (
                <div className="absolute top-12 right-0 w-72 sm:w-80 bg-[#141822] border border-[#2e3444] rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-[#232732] mb-3">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-[#4d8eff]" />
                      <span className="text-xs font-bold text-white font-mono">
                        TELEMETRÍA EN VIVO
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={onForceSync}
                      className="p-1 text-[#8c909f] hover:text-white rounded transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2 text-xs font-mono text-[#8c909f]">
                    <div className="flex justify-between">
                      <span>1. Espejo Socket.io:</span>
                      <span className={syncState.isConnected ? 'text-[#34d399] font-bold' : 'text-[#ef4444]'}>
                        {syncState.isConnected ? 'Conectado' : 'Offline'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>2. Canal SSE:</span>
                      <span className={sseConnected ? 'text-cyan-400 font-bold' : 'text-amber-400'}>
                        {sseConnected ? 'Activo (20s)' : 'Reconectando'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>3. Persistencia Dual:</span>
                      <span className="text-[#a5b4fc] font-bold">Firestore + JSON</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cola Offline:</span>
                      <span className={fifoQueueLength > 0 ? 'text-amber-400 font-bold' : 'text-[#34d399]'}>
                        {fifoQueueLength} pendientes
                      </span>
                    </div>
                  </div>
                  <div className="pt-3 mt-3 border-t border-[#232732]">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMirrorDetails(false);
                        onOpenCascadeWindow('telemetry');
                      }}
                      className="w-full py-1.5 rounded-lg bg-[#1e2535] hover:bg-[#283247] text-white text-[10px] font-mono text-center block transition"
                    >
                      Abrir Panel de Telemetría Completo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Perfil & Rol / Auth Trigger */}
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-xl bg-[#141822] hover:bg-[#1f2535] border border-[#2e3444] transition cursor-pointer text-left"
              title="Cambiar rol o ingresar PIN"
            >
              <div className="w-6 h-6 rounded-lg bg-[#4d8eff]/15 text-[#4d8eff] flex items-center justify-center font-bold text-xs border border-[#4d8eff]/30">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-[#dfe2ee] leading-tight">
                  {session.name.split(' ')[0]}
                </span>
                <span className="text-[9px] font-mono text-[#8c909f] leading-tight capitalize">
                  {session.role}
                </span>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. ÁREA DE PANTALLA PRINCIPAL ADAPTATIVA                      */}
      {/* ============================================================== */}
      <main className="flex-1 w-full max-w-full pt-28 pb-8 min-h-screen flex flex-col">
        {viewDevice === 'mobile' && mobileFramePreview ? (
          /* Vista de marco de celular (para previsualizar experiencia móvil en PC) */
          <div className="w-full flex-1 flex justify-center items-start p-2 sm:p-6 bg-[#060910]">
            <div className="w-full max-w-[450px] min-h-[820px] bg-[#0b0e17] rounded-[48px] border-[10px] border-[#2b303e] shadow-2xl p-4 flex flex-col relative overflow-hidden ring-2 ring-black">
              {/* Dynamic Island / Muesca Superior */}
              <div className="w-36 h-6 bg-[#161a25] rounded-full mx-auto mb-4 flex items-center justify-center gap-2 border border-[#2b303e]/60">
                <div className="w-2.5 h-2.5 rounded-full bg-[#0a0e16]" />
                <div className="w-10 h-1.5 bg-[#2b303e] rounded-full" />
              </div>
              <div className="flex-1 overflow-y-auto min-w-0">
                {children}
              </div>
            </div>
          </div>
        ) : (
          /* Contenedor Adaptativo Fluido Principal */
          <div
            className={`p-3 sm:p-5 md:p-6 w-full ${
              isFullWidth ? 'max-w-none' : 'max-w-7xl'
            } mx-auto flex-1 min-w-0`}
          >
            {children}
          </div>
        )}
      </main>
    </div>
  );
};
