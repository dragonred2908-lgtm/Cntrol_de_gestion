import React from 'react';
import { UserSession, TelegramConfig } from '../types';

interface HeaderProps {
  session: UserSession;
  telegramConfig: TelegramConfig;
  sseConnected?: boolean;
  sseLastHeartbeat?: string | null;
  sseClientsCount?: number;
  dualPersistenceStatus?: any;
  fifoQueueLength?: number;
  onFlushQueue?: () => void;
  isFlushingQueue?: boolean;
  onOpenNewOrder: () => void;
  onOpenReminder: () => void;
  onOpenAuth: () => void;
  onOpenExport: () => void;
  onNavigateToSimulator: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  telegramConfig,
  sseConnected = true,
  sseLastHeartbeat = null,
  sseClientsCount = 1,
  fifoQueueLength = 0,
  onFlushQueue,
  isFlushingQueue = false,
  onOpenNewOrder,
  onOpenAuth,
  onOpenExport,
  onNavigateToSimulator,
}) => {
  const isConnected = telegramConfig.status === 'connected';
  const botUser = telegramConfig.botUsername || '@nucleo_control_bot';
  const chatId = telegramConfig.groupChatId || '-1002692322280';

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-[#181c24]/95 backdrop-blur-md z-40 flex items-center justify-between px-5 shadow-[0_1px_8px_rgba(0,0,0,0.35)] border-b border-[#31353e]/60">
      {/* Left: Brand + Telegram Bot Live Telemetry Pill */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#005ac2] to-[#4d8eff] flex items-center justify-center text-white font-bold text-sm shadow-sm ring-1 ring-[#adc6ff]/30">
            NC
          </div>
          <div className="flex flex-col">
            <span className="font-sans text-sm text-[#dfe2ee] tracking-wider uppercase font-bold leading-tight">
              NÚCLEO CONTROL
            </span>
            <span className="font-mono text-[10px] text-[#8c909f] tracking-wider font-normal leading-tight">
              Sistema Control de Gestión v2.4
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-[#31353e]"></div>

        {/* Telegram Live Connection Pill */}
        <button
          onClick={onNavigateToSimulator}
          className="flex items-center gap-2.5 bg-[#0a0e16] hover:bg-[#111622] px-3 py-1 rounded-xl shadow-[inset_0_0_0_1px_rgba(66,71,84,0.3)] transition text-left cursor-pointer"
          title="Ver canal y estado de Telegram"
        >
          <div className="relative flex items-center justify-center w-2.5 h-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4edea3] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4edea3]"></span>
          </div>
          <div className="flex flex-col font-mono text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="text-[#4edea3] font-semibold">Bot {botUser}:</span>
              <span className="text-[#c2c6d6]">{isConnected ? 'En Línea' : 'Simulador'}</span>
            </div>
            <span className="text-[#8c909f] text-[9px] tracking-tight">Chat ID: {chatId}</span>
          </div>
        </button>

        {/* Canal SSE Live Telemetry Pill */}
        <div
          className="hidden lg:flex items-center gap-2.5 bg-[#0a0e16] px-3 py-1 rounded-xl shadow-[inset_0_0_0_1px_rgba(66,71,84,0.3)]"
          title={`Canal SSE (Server-Sent Events) con heartbeat cada 20s. Último latido: ${sseLastHeartbeat || 'Iniciando'}`}
        >
          <div className="relative flex items-center justify-center w-2.5 h-2.5">
            {sseConnected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            )}
          </div>
          <div className="flex flex-col font-mono text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className={sseConnected ? 'text-cyan-400 font-semibold' : 'text-amber-400 font-semibold'}>
                Canal SSE:
              </span>
              <span className="text-[#c2c6d6]">{sseConnected ? 'Activo (20s)' : 'Reconectando...'}</span>
            </div>
            <span className="text-[#8c909f] text-[9px] tracking-tight">
              {sseClientsCount ? `${sseClientsCount} cliente(s) en vivo` : 'Heartbeat 20s'}
            </span>
          </div>
        </div>

        {/* Persistencia Dual & FIFO Queue Pill */}
        <div
          className="hidden xl:flex items-center gap-2.5 bg-[#0a0e16] px-3 py-1 rounded-xl shadow-[inset_0_0_0_1px_rgba(66,71,84,0.3)]"
          title="Persistencia Dual: Firestore base primaria + Respaldo Local JSON con resolución de conflictos por updatedAt"
        >
          <div className="flex flex-col font-mono text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="text-indigo-400 font-semibold">Dual Storage:</span>
              <span className="text-[#c2c6d6]">Firestore / JSON</span>
            </div>
            <div className="flex items-center gap-1 text-[9px]">
              <span className="text-slate-400">Cola FIFO:</span>
              <span className={fifoQueueLength > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-semibold'}>
                {fifoQueueLength} pend.
              </span>
              {fifoQueueLength > 0 && onFlushQueue && (
                <button
                  onClick={onFlushQueue}
                  disabled={isFlushingQueue}
                  className="ml-1 text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded cursor-pointer transition font-mono"
                  type="button"
                >
                  {isFlushingQueue ? 'Subiendo...' : 'Subir'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Actions and Role Status */}
      <div className="flex items-center gap-3">
        {/* + Nueva Orden Button */}
        <button
          onClick={onOpenNewOrder}
          className="flex items-center gap-1.5 h-9 px-3.5 bg-[#4d8eff] text-[#00285d] hover:bg-[#adc6ff] hover:text-[#002e6a] rounded font-mono text-[11px] font-semibold transition-colors shadow-sm active:scale-95 cursor-pointer"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>+ Nueva Orden</span>
        </button>

        {/* Exportar Button */}
        <button
          onClick={onOpenExport}
          className="flex items-center gap-1.5 h-9 px-3.5 bg-[#1c2028] text-[#dfe2ee] hover:bg-[#262a33] hover:text-[#ffffff] rounded font-mono text-[11px] transition-colors cursor-pointer border border-[#31353e]/40"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px] text-[#8c909f]">download</span>
          <span>Exportar</span>
        </button>

        <div className="h-6 w-px bg-[#31353e]"></div>

        {/* Role & PIN chip */}
        <div className="flex items-center gap-2 bg-[#1c2028] px-3 py-1.5 rounded font-mono text-[10px] text-[#dfe2ee] border border-[#31353e]/50">
          <span className="material-symbols-outlined text-[16px] text-[#adc6ff]">security</span>
          <span className="text-[#c2c6d6]">
            [Rol:{' '}
            <span className="text-[#adc6ff] font-semibold">
              {session.role === 'admin' ? 'Admin' : session.role === 'developer' ? 'Dev' : 'Viewer'}
            </span>{' '}
            - PIN: <span className="text-[#8c909f]">••••56</span>]
          </span>
          <button
            onClick={onOpenAuth}
            className="ml-1 text-[#8c909f] hover:text-[#dfe2ee] flex items-center cursor-pointer transition-colors"
            title="Cambiar Rol o Validar PIN"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
          </button>
        </div>

        {/* User Avatar */}
        <button
          onClick={onOpenAuth}
          className="w-8 h-8 rounded-full bg-[#adc6ff] flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-[#4d8eff] transition"
          title={session.name}
          type="button"
        >
          <span className="material-symbols-outlined text-[#002e6a] text-[18px]">person</span>
        </button>
      </div>
    </header>
  );
};
