import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  History,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Send,
  Settings,
  Users,
  Wifi,
  WifiOff,
  X,
  Radio,
  CloudOff,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
} from 'lucide-react';
import { useRoute, Page } from './router';
import { useWorkspace } from './workspace';
import { cn } from '../lib/helpers';
import { Avatar, Button } from '../ui/kit';

interface NavItem {
  page: Page;
  path: string;
  label: string;
  icon: React.ElementType;
  badge?: 'pending' | 'live';
}

const NAV: NavItem[] = [
  { page: 'today', path: '/hoy', label: 'Hoy', icon: LayoutDashboard },
  { page: 'orders', path: '/ordenes', label: 'Órdenes', icon: ClipboardList, badge: 'pending' },
  { page: 'team', path: '/equipo', label: 'Equipo', icon: Users },
  { page: 'telegram', path: '/telegram', label: 'Telegram', icon: Send, badge: 'live' },
  { page: 'reports', path: '/reportes', label: 'Reportes', icon: BarChart3 },
  { page: 'audit', path: '/auditoria', label: 'Auditoría', icon: History },
  { page: 'settings', path: '/ajustes', label: 'Ajustes', icon: Settings },
];

/* -------------------------------------------------------------------------- */
/* Sidebar                                                                    */
/* -------------------------------------------------------------------------- */

function SidebarContent({
  routePage,
  onNavigate,
  collapsed,
}: {
  routePage: Page;
  onNavigate: (path: string) => void;
  collapsed: boolean;
}) {
  const { stats, telegramConfig } = useWorkspace();

  return (
    <div className="flex flex-col h-full">
      <div className={cn('flex items-center gap-2.5 h-[60px] shrink-0 border-b border-[var(--line)]', collapsed ? 'justify-center px-2' : 'px-4')}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4d8dff] to-[#1f4fb8] flex items-center justify-center shrink-0 shadow-[0_6px_16px_-6px_rgba(77,141,255,0.8)]">
          <Radio size={16} className="text-white" strokeWidth={2.4} />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold tracking-[0.1em] text-[var(--txt)] leading-none">NÚCLEO</div>
            <div className="text-[9.5px] font-mono uppercase tracking-[0.18em] text-[var(--txt-3)] mt-1">Control de Gestión</div>
          </div>
        ) : null}
      </div>

      <nav className={cn('flex-1 overflow-y-auto py-3 space-y-1', collapsed ? 'px-2' : 'px-3')}>
        {!collapsed ? <div className="eyebrow px-2 pb-1">Operación</div> : null}
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = routePage === item.page || (routePage === 'order' && item.page === 'orders');
          return (
            <button
              key={item.page}
              type="button"
              className="nav-item w-full"
              data-active={active}
              onClick={() => onNavigate(item.path)}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={17} strokeWidth={1.9} className="shrink-0" />
              {!collapsed ? (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.badge === 'pending' && stats.pending > 0 ? (
                    <span className="mono text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[var(--accent-soft)] text-[var(--accent-2)] border border-[rgba(77,141,255,0.25)]">
                      {stats.pending}
                    </span>
                  ) : null}
                  {item.badge === 'live' ? (
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        telegramConfig.status === 'connected' ? 'bg-[var(--ok)]' : 'bg-[var(--txt-3)]',
                      )}
                    />
                  ) : null}
                </>
              ) : null}
            </button>
          );
        })}
      </nav>

      {!collapsed ? (
        <div className="px-3 pb-3">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="eyebrow">Estado del sistema</span>
              <span className="live-dot" />
            </div>
            <div className="space-y-1.5 mono text-[10.5px] text-[var(--txt-3)]">
              <div className="flex justify-between">
                <span>Pendientes</span>
                <span className="text-[var(--txt)]">{stats.pending}</span>
              </div>
              <div className="flex justify-between">
                <span>Vencidas</span>
                <span className={stats.overdue > 0 ? 'text-[#ff93a0]' : 'text-[var(--txt)]'}>{stats.overdue}</span>
              </div>
              <div className="flex justify-between">
                <span>Cumplimiento</span>
                <span className="text-[#55e8b8]">{stats.completionRate}%</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Toasts                                                                     */
/* -------------------------------------------------------------------------- */

const TOAST_ICON = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

function ToastStack() {
  const { toasts, dismissToast } = useWorkspace();
  return (
    <div className="toast-stack">
      {toasts.map((toast) => {
        const Icon = TOAST_ICON[toast.tone];
        return (
          <div key={toast.id} className="toast" data-tone={toast.tone}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <span className="flex-1 leading-snug">{toast.message}</span>
            <button type="button" onClick={() => dismissToast(toast.id)} className="text-[var(--txt-3)] hover:text-[var(--txt)]">
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shell                                                                      */
/* -------------------------------------------------------------------------- */

export function AppShell({ children, onNewOrder }: { children: React.ReactNode; onNewOrder: () => void }) {
  const { route, navigate, title } = useRoute();
  const { stats, socketConnected, sseConnected, deviceCount, queueLength, session, telegramConfig } = useWorkspace();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('nucleo_sidebar_collapsed') === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('nucleo_sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [route.path]);

  // Atajo: Ctrl/Cmd + K para buscar
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const go = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const value = search.trim();
    go(value ? `/ordenes?q=${encodeURIComponent(value)}` : '/ordenes');
  };

  const online = socketConnected || sseConnected;
  const sidebarWidth = collapsed ? 72 : 248;

  return (
    <div className="app-bg min-h-screen">
      {/* ---- Sidebar desktop ---- */}
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col bg-black/95 backdrop-blur border-r border-[var(--line)] transition-[width] duration-200"
        style={{ width: sidebarWidth }}
      >
        <SidebarContent routePage={route.page} onNavigate={go} collapsed={collapsed} />
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="absolute -right-3 top-[72px] w-6 h-6 rounded-full bg-[var(--panel-2)] border border-[var(--line-strong)] flex items-center justify-center text-[var(--txt-2)] hover:text-[var(--txt)] hover:border-[var(--accent)] transition-colors"
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </aside>

      {/* ---- Sidebar mobile ---- */}
      {mobileOpen ? (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[264px] bg-black border-r border-[var(--line)] flex flex-col">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-2 text-[var(--txt-3)] hover:text-[var(--txt)] p-2"
              aria-label="Cerrar menú"
            >
              <X size={18} />
            </button>
            <SidebarContent routePage={route.page} onNavigate={go} collapsed={false} />
          </aside>
        </div>
      ) : null}

      {/* ---- Main ---- */}
      <div className="main-offset" style={{ ['--sidebar-w-current' as string]: `${sidebarWidth}px` }}>
        <header className="sticky top-0 z-30 h-[60px] bg-black/90 backdrop-blur-md border-b border-[var(--line)]">
            <div className="h-full px-4 sm:px-6 flex items-center gap-3">
              <button
                type="button"
                className="lg:hidden text-[var(--txt-2)] hover:text-[var(--txt)]"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menú"
              >
                <Menu size={20} />
              </button>

              <div className="min-w-0 hidden sm:block">
                <div className="text-[13px] font-semibold text-[var(--txt)] leading-none truncate">{title}</div>
                <div className="text-[10.5px] text-[var(--txt-3)] mt-1 mono">
                  {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}
                </div>
              </div>

              <form onSubmit={submitSearch} className="flex-1 max-w-md mx-auto hidden md:block">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--txt-3)]" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar órdenes, personas…"
                    className="input h-9 pl-9 pr-14 bg-[var(--panel)]/70 text-[12.5px]"
                    aria-label="Buscar"
                  />
                  <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 mono text-[9.5px] text-[var(--txt-3)] border border-[var(--line-strong)] rounded px-1.5 py-0.5">
                    Ctrl K
                  </kbd>
                </div>
              </form>

              <div className="flex items-center gap-2 ml-auto">
                {queueLength > 0 ? (
                  <span
                    className="hidden sm:inline-flex items-center gap-1.5 h-7 px-2 rounded-md bg-[var(--warn-soft)] border border-[rgba(247,178,59,0.3)] text-[10.5px] mono text-[#ffc971]"
                    title="Cambios pendientes de sincronización"
                  >
                    <CloudOff size={12} />
                    {queueLength} pend.
                  </span>
                ) : null}

                <div
                  className="hidden sm:flex items-center gap-2 h-7 px-2.5 rounded-md border border-[var(--line)] bg-[var(--panel)]/60"
                  title={`Socket ${socketConnected ? 'conectado' : 'desconectado'} · SSE ${sseConnected ? 'conectado' : 'desconectado'}`}
                >
                  {online ? <Wifi size={12} className="text-[#55e8b8]" /> : <WifiOff size={12} className="text-[#ff93a0]" />}
                  <span className={cn('mono text-[10px]', online ? 'text-[#55e8b8]' : 'text-[#ff93a0]')}>
                    {online ? 'EN LÍNEA' : 'OFFLINE'}
                  </span>
                  <span className="text-[var(--txt-3)] mono text-[10px]">· {deviceCount}</span>
                </div>

                <div className="hidden sm:block">
                  <Button variant="primary" size="sm" icon={Plus} onClick={onNewOrder}>
                    Nueva orden
                  </Button>
                </div>
                <div className="sm:hidden">
                  <Button variant="primary" size="sm" iconOnly icon={Plus} onClick={onNewOrder} aria-label="Nueva orden" />
                </div>

                <button
                  type="button"
                  onClick={() => go('/ajustes')}
                  className="flex items-center gap-2 pl-1.5 pr-2 h-9 rounded-lg border border-transparent hover:border-[var(--line)] hover:bg-[var(--panel)] transition-colors"
                  title={session.name}
                >
                  <Avatar name={session.name} color="#4d8dff" size={26} />
                  <span className="hidden xl:block text-[12px] text-[var(--txt-2)] max-w-[120px] truncate">{session.name}</span>
                </button>
              </div>
            </div>
          </header>

          <main className="px-4 sm:px-6 py-5 sm:py-6 pb-16 w-full max-w-[1640px] mx-auto">{children}</main>

          <footer className="hidden sm:flex items-center justify-between px-6 pb-5 text-[10.5px] mono text-[var(--txt-3)]">
            <span>NÚCLEO CONTROL · v3.0</span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className={cn('w-1.5 h-1.5 rounded-full', telegramConfig.status === 'connected' ? 'bg-[var(--ok)]' : 'bg-[var(--txt-3)]')} />
                Telegram {telegramConfig.status === 'connected' ? 'conectado' : 'sin token'}
              </span>
              <span>{stats.total} órdenes · {stats.completionRate}% cumplimiento</span>
            </span>
          </footer>
      </div>

      <ToastStack />
    </div>
  );
}
