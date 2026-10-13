import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Users,
  Send,
  Terminal,
  Sparkles,
  Activity,
  FileSpreadsheet,
  Radio,
  Shield,
  Layers,
  Bell,
  CheckCircle2,
  Clock,
  Laptop,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { UserSession, TelegramConfig, MirrorSyncState } from '../types';
import { hasPermission } from '../lib/rbacConfig';

export type CascadeWindowType =
  | 'professionals'
  | 'telegram'
  | 'simulator'
  | 'kpi'
  | 'activity'
  | 'export'
  | 'telemetry'
  | 'auth'
  | 'reminder'
  | 'new-order'
  | null;

interface CascadingMenuProps {
  session: UserSession;
  telegramConfig: TelegramConfig;
  syncState: MirrorSyncState;
  pendingOrdersCount: number;
  totalOrdersCount: number;
  onOpenWindow: (windowType: CascadeWindowType) => void;
  onOpenNewOrder: () => void;
}

export const CascadingMenu: React.FC<CascadingMenuProps> = ({
  session,
  telegramConfig,
  syncState,
  pendingOrdersCount,
  totalOrdersCount,
  onOpenWindow,
  onOpenNewOrder,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveSubmenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectWindow = (windowType: CascadeWindowType) => {
    onOpenWindow(windowType);
    setIsOpen(false);
    setActiveSubmenu(null);
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Botón Disparador del Menú Cascada */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setActiveSubmenu(null);
        }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer shadow-sm ${
          isOpen
            ? 'bg-[#1e2538] border-[#4d8eff] text-white ring-1 ring-[#4d8eff]/30'
            : 'bg-[#161a24] hover:bg-[#1f2535] border-[#2b303e] text-[#dfe2ee]'
        }`}
        title="Abrir menú en cascada con ventanas secundarias y herramientas"
      >
        <Layers className="w-3.5 h-3.5 text-[#4d8eff]" />
        <span className="font-semibold hidden sm:inline">Módulos & Ventanas</span>
        <span className="font-semibold sm:hidden">Menú</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#8c909f] transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#4d8eff]' : ''
          }`}
        />
      </button>

      {/* Primer Nivel del Menú Cascada */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl bg-[#0e1420] border border-[#232732] shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 border-b border-[#232732] mb-1 flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#8c909f] font-semibold">
              Ventanas Secundarias (Cascada)
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1e2330] text-[#a5b4fc]">
              Nivel 1
            </span>
          </div>

          <div className="space-y-0.5">
            {/* Opción 1: Personal & Especialistas */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu('specialists')}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSubmenu(activeSubmenu === 'specialists' ? null : 'specialists');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition cursor-pointer ${
                  activeSubmenu === 'specialists'
                    ? 'bg-[#1c2333] text-white font-medium border-l-2 border-[#3b82f6]'
                    : 'text-[#c2c6d6] hover:bg-[#1a1f2c] hover:text-[#dfe2ee]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-[#3b82f6]/15 text-[#60a5fa] flex items-center justify-center">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium">Equipo & Especialistas</div>
                    <div className="text-[10px] text-[#717686]">Directorio y carga</div>
                  </div>
                </div>
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    activeSubmenu === 'specialists'
                      ? 'rotate-90 sm:rotate-0 text-[#60a5fa]'
                      : 'text-[#717686]'
                  }`}
                />
              </button>

              {/* Submenú en Cascada (Nivel 2) - Desktop flotante a la derecha, Móvil inline */}
              {activeSubmenu === 'specialists' && (
                <>
                  {/* Vista Desktop (Cascada hacia la derecha) */}
                  <div className="hidden sm:block absolute left-full top-0 ml-1.5 w-72 rounded-2xl bg-[#0e1420] border border-[#232732] shadow-2xl py-2 z-[60] animate-in fade-in slide-in-from-left-2 duration-150">
                    <div className="px-3 py-1.5 border-b border-[#232732] mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-mono text-[#60a5fa] uppercase tracking-wider font-semibold">
                        › Submenú Especialistas
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1e2330] text-[#60a5fa]">
                        Nivel 2
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('professionals');
                      }}
                      className="w-full px-3 py-2 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 transition cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-[#60a5fa]" />
                      <span>Ver Directorio & Desempeño</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('reminder');
                      }}
                      className="w-full px-3 py-2 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 transition cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5 text-[#fbbf24]" />
                      <span>Despachar Notificación a Personal</span>
                    </button>
                  </div>

                  {/* Vista Móvil (Acordeón expandible hacia abajo) */}
                  <div className="sm:hidden mx-2 my-1 p-1.5 rounded-xl bg-[#090d15] border border-[#1f293d] space-y-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('professionals');
                      }}
                      className="w-full px-2.5 py-1.5 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 rounded-lg transition"
                    >
                      <Users className="w-3.5 h-3.5 text-[#60a5fa]" />
                      <span>Directorio & Desempeño</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('reminder');
                      }}
                      className="w-full px-2.5 py-1.5 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 rounded-lg transition"
                    >
                      <Bell className="w-3.5 h-3.5 text-[#fbbf24]" />
                      <span>Notificación Telegram</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Opción 2: Telegram & Automatización */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu('telegram')}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSubmenu(activeSubmenu === 'telegram' ? null : 'telegram');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition cursor-pointer ${
                  activeSubmenu === 'telegram'
                    ? 'bg-[#1c2333] text-white font-medium border-l-2 border-[#229ed9]'
                    : 'text-[#c2c6d6] hover:bg-[#1a1f2c] hover:text-[#dfe2ee]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-[#229ed9]/15 text-[#229ed9] flex items-center justify-center">
                    <Send className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium">Telegram & Canal</div>
                    <div className="text-[10px] text-[#717686]">
                      {telegramConfig.status === 'connected' ? 'En Línea' : 'Simulador'}
                    </div>
                  </div>
                </div>
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    activeSubmenu === 'telegram'
                      ? 'rotate-90 sm:rotate-0 text-[#229ed9]'
                      : 'text-[#717686]'
                  }`}
                />
              </button>

              {/* Submenú en Cascada (Nivel 2) */}
              {activeSubmenu === 'telegram' && (
                <>
                  {/* Desktop Flotante Cascada */}
                  <div className="hidden sm:block absolute left-full top-0 ml-1.5 w-72 rounded-2xl bg-[#0e1420] border border-[#232732] shadow-2xl py-2 z-[60] animate-in fade-in slide-in-from-left-2 duration-150">
                    <div className="px-3 py-1.5 border-b border-[#232732] mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-mono text-[#229ed9] uppercase tracking-wider font-semibold">
                        › Submenú Telegram
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1e2330] text-[#229ed9]">
                        Nivel 2
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('telegram');
                      }}
                      className="w-full px-3 py-2 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 transition cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5 text-[#229ed9]" />
                      <span>Configuración Bot & Canal</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('simulator');
                      }}
                      className="w-full px-3 py-2 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 transition cursor-pointer"
                    >
                      <Terminal className="w-3.5 h-3.5 text-[#a5b4fc]" />
                      <span>Consola Simulador & Debug (DEV)</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('reminder');
                      }}
                      className="w-full px-3 py-2 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 transition cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5 text-[#fbbf24]" />
                      <span>Enviar Recordatorio Rápido</span>
                    </button>
                  </div>

                  {/* Móvil Acordeón */}
                  <div className="sm:hidden mx-2 my-1 p-1.5 rounded-xl bg-[#090d15] border border-[#1f293d] space-y-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('telegram');
                      }}
                      className="w-full px-2.5 py-1.5 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 rounded-lg transition"
                    >
                      <Send className="w-3.5 h-3.5 text-[#229ed9]" />
                      <span>Configuración Bot</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('simulator');
                      }}
                      className="w-full px-2.5 py-1.5 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 rounded-lg transition"
                    >
                      <Terminal className="w-3.5 h-3.5 text-[#a5b4fc]" />
                      <span>Simulador Telegram</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('reminder');
                      }}
                      className="w-full px-2.5 py-1.5 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 rounded-lg transition"
                    >
                      <Bell className="w-3.5 h-3.5 text-[#fbbf24]" />
                      <span>Recordatorio Rápido</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Opción 3: Inteligencia Operativa (KPIs IA) */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu('intelligence')}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSubmenu(activeSubmenu === 'intelligence' ? null : 'intelligence');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition cursor-pointer ${
                  activeSubmenu === 'intelligence'
                    ? 'bg-[#1c2333] text-white font-medium border-l-2 border-[#a855f7]'
                    : 'text-[#c2c6d6] hover:bg-[#1a1f2c] hover:text-[#dfe2ee]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-[#a855f7]/15 text-[#c084fc] flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium">Inteligencia & Rendimiento</div>
                    <div className="text-[10px] text-[#717686]">Análisis IA de KPIs</div>
                  </div>
                </div>
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    activeSubmenu === 'intelligence'
                      ? 'rotate-90 sm:rotate-0 text-[#c084fc]'
                      : 'text-[#717686]'
                  }`}
                />
              </button>

              {/* Submenú en Cascada (Nivel 2) */}
              {activeSubmenu === 'intelligence' && (
                <>
                  {/* Desktop Flotante Cascada */}
                  <div className="hidden sm:block absolute left-full top-0 ml-1.5 w-72 rounded-2xl bg-[#0e1420] border border-[#232732] shadow-2xl py-2 z-[60] animate-in fade-in slide-in-from-left-2 duration-150">
                    <div className="px-3 py-1.5 border-b border-[#232732] mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-mono text-[#c084fc] uppercase tracking-wider font-semibold">
                        › Submenú Inteligencia
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1e2330] text-[#c084fc]">
                        Nivel 2
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('kpi');
                      }}
                      className="w-full px-3 py-2 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#c084fc]" />
                      <span>Diagnóstico IA de Rendimiento (KPIs)</span>
                    </button>
                  </div>

                  {/* Móvil Acordeón */}
                  <div className="sm:hidden mx-2 my-1 p-1.5 rounded-xl bg-[#090d15] border border-[#1f293d] space-y-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('kpi');
                      }}
                      className="w-full px-2.5 py-1.5 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 rounded-lg transition"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#c084fc]" />
                      <span>Diagnóstico IA de Rendimiento</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Opción 4: Auditoría, Reportes & Sistema */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu('audit')}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSubmenu(activeSubmenu === 'audit' ? null : 'audit');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition cursor-pointer ${
                  activeSubmenu === 'audit'
                    ? 'bg-[#1c2333] text-white font-medium border-l-2 border-[#10b981]'
                    : 'text-[#c2c6d6] hover:bg-[#1a1f2c] hover:text-[#dfe2ee]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-[#10b981]/15 text-[#34d399] flex items-center justify-center">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium">Auditoría & Datos</div>
                    <div className="text-[10px] text-[#717686]">Logs, Reportes, Sincro</div>
                  </div>
                </div>
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    activeSubmenu === 'audit'
                      ? 'rotate-90 sm:rotate-0 text-[#34d399]'
                      : 'text-[#717686]'
                  }`}
                />
              </button>

              {/* Submenú en Cascada (Nivel 2) */}
              {activeSubmenu === 'audit' && (
                <>
                  {/* Desktop Flotante Cascada */}
                  <div className="hidden sm:block absolute left-full top-0 ml-1.5 w-72 rounded-2xl bg-[#0e1420] border border-[#232732] shadow-2xl py-2 z-[60] animate-in fade-in slide-in-from-left-2 duration-150">
                    <div className="px-3 py-1.5 border-b border-[#232732] mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-mono text-[#34d399] uppercase tracking-wider font-semibold">
                        › Submenú Auditoría
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1e2330] text-[#34d399]">
                        Nivel 2
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('activity');
                      }}
                      className="w-full px-3 py-2 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 transition cursor-pointer"
                    >
                      <Activity className="w-3.5 h-3.5 text-[#34d399]" />
                      <span>Registro de Actividad (Logs en Vivo)</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('export');
                      }}
                      className="w-full px-3 py-2 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 transition cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#60a5fa]" />
                      <span>Exportar Auditoría (Excel / PDF)</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('telemetry');
                      }}
                      className="w-full px-3 py-2 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 transition cursor-pointer"
                    >
                      <Radio className="w-3.5 h-3.5 text-[#38bdf8]" />
                      <span>Panel de Telemetría (Espejo + SSE)</span>
                    </button>
                  </div>

                  {/* Móvil Acordeón */}
                  <div className="sm:hidden mx-2 my-1 p-1.5 rounded-xl bg-[#090d15] border border-[#1f293d] space-y-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('activity');
                      }}
                      className="w-full px-2.5 py-1.5 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 rounded-lg transition"
                    >
                      <Activity className="w-3.5 h-3.5 text-[#34d399]" />
                      <span>Logs en Vivo</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('export');
                      }}
                      className="w-full px-2.5 py-1.5 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 rounded-lg transition"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#60a5fa]" />
                      <span>Exportar Excel / PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('telemetry');
                      }}
                      className="w-full px-2.5 py-1.5 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 rounded-lg transition"
                    >
                      <Radio className="w-3.5 h-3.5 text-[#38bdf8]" />
                      <span>Telemetría</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Opción 5: Seguridad & Roles */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu('security')}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSubmenu(activeSubmenu === 'security' ? null : 'security');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition cursor-pointer ${
                  activeSubmenu === 'security'
                    ? 'bg-[#1c2333] text-white font-medium border-l-2 border-[#f59e0b]'
                    : 'text-[#c2c6d6] hover:bg-[#1a1f2c] hover:text-[#dfe2ee]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-[#f59e0b]/15 text-[#fbbf24] flex items-center justify-center">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-medium">Seguridad & Sesión</div>
                    <div className="text-[10px] text-[#717686]">Rol: {session.role}</div>
                  </div>
                </div>
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    activeSubmenu === 'security'
                      ? 'rotate-90 sm:rotate-0 text-[#fbbf24]'
                      : 'text-[#717686]'
                  }`}
                />
              </button>

              {/* Submenú en Cascada (Nivel 2) */}
              {activeSubmenu === 'security' && (
                <>
                  {/* Desktop Flotante Cascada */}
                  <div className="hidden sm:block absolute left-full top-0 ml-1.5 w-72 rounded-2xl bg-[#0e1420] border border-[#232732] shadow-2xl py-2 z-[60] animate-in fade-in slide-in-from-left-2 duration-150">
                    <div className="px-3 py-1.5 border-b border-[#232732] mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-mono text-[#fbbf24] uppercase tracking-wider font-semibold">
                        › Submenú Seguridad
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1e2330] text-[#fbbf24]">
                        Nivel 2
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('auth');
                      }}
                      className="w-full px-3 py-2 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 transition cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5 text-[#fbbf24]" />
                      <span>Cambiar Rol / PIN de Administrador</span>
                    </button>
                  </div>

                  {/* Móvil Acordeón */}
                  <div className="sm:hidden mx-2 my-1 p-1.5 rounded-xl bg-[#090d15] border border-[#1f293d] space-y-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWindow('auth');
                      }}
                      className="w-full px-2.5 py-1.5 text-xs text-left text-[#c2c6d6] hover:bg-[#1c2333] hover:text-white flex items-center gap-2 rounded-lg transition"
                    >
                      <Shield className="w-3.5 h-3.5 text-[#fbbf24]" />
                      <span>Cambiar Rol / PIN</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="pt-2 mt-2 border-t border-[#232732] px-3">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenNewOrder();
              }}
              className="w-full py-2 rounded-xl bg-gradient-to-r from-[#005ac2] to-[#2563eb] hover:from-[#00489d] hover:to-[#1d4ed8] text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-[#005ac2]/25"
            >
              <span>➕ Crear Nueva Orden</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
