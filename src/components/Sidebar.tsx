import React, { useState, useEffect } from 'react';
import { UserSession } from '../types';

export type TabType =
  | 'dashboard'
  | 'orders'
  | 'professionals'
  | 'telegram'
  | 'simulator'
  | 'activity';

interface SidebarProps {
  currentTab: TabType;
  onChangeTab: (tab: TabType) => void;
  pendingOrdersCount: number;
  totalOrdersCount: number;
  session: UserSession;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onChangeTab,
  pendingOrdersCount,
}) => {
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = now.toISOString().replace('T', ' ').substring(0, 16);
      setCurrentTime(formatted);
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    {
      id: 'dashboard' as TabType,
      label: 'Dashboard',
      icon: 'analytics',
      badge: null,
    },
    {
      id: 'orders' as TabType,
      label: 'Órdenes',
      icon: 'assignment',
      badge: (
        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#4d8eff] text-[#00285d] font-bold">
          {pendingOrdersCount > 0 ? pendingOrdersCount : '0'}
        </span>
      ),
    },
    {
      id: 'professionals' as TabType,
      label: 'Profesionales',
      icon: 'badge',
      badge: (
        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#31353e] text-[#c2c6d6] font-semibold">
          8
        </span>
      ),
    },
    {
      id: 'telegram' as TabType,
      label: 'Telegram & Push',
      icon: 'send',
      badge: (
        <span className="flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#00a572] text-[#00311f] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6ffbbe]"></span>
          <span>Online</span>
        </span>
      ),
    },
    {
      id: 'simulator' as TabType,
      label: 'Reportes & Bot',
      icon: 'summarize',
      badge: <span className="font-mono text-[10px] text-[#8c909f]">PDF/XLS</span>,
    },
    {
      id: 'activity' as TabType,
      label: 'Historial Auditoría',
      icon: 'history',
      badge: null,
    },
  ];

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-[#0a0e16] z-30 flex flex-col justify-between py-3 border-r border-[#31353e]/40 select-none">
      {/* Navigation Top Section */}
      <div className="flex flex-col gap-2 px-2">
        <div className="px-3 py-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#8c909f]">
            Módulos de Control
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className={`flex items-center justify-between px-3 py-2.5 rounded transition-colors text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#262a33] text-[#adc6ff] font-semibold'
                    : 'text-[#c2c6d6] hover:bg-[#1c2028] hover:text-[#dfe2ee] font-normal'
                }`}
                type="button"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      isActive ? 'text-[#adc6ff]' : 'text-[#8c909f]'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="text-[13px]">{item.label}</span>
                </div>
                {item.badge}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Security & PIN telemetry widget */}
      <div className="px-3">
        <div className="bg-[#181c24] rounded-lg p-3 flex flex-col gap-2 border border-[#31353e]/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#4edea3]">lock</span>
              <span className="font-mono text-[10px] text-[#dfe2ee] font-semibold uppercase tracking-wider">
                Seguridad & PIN
              </span>
            </div>
            <span className="font-mono text-[10px] text-[#4edea3] bg-[#4edea3]/10 px-1.5 py-0.5 rounded font-semibold">
              Activa
            </span>
          </div>

          <div className="flex flex-col font-mono text-[10px] text-[#8c909f] gap-0.5">
            <div className="flex justify-between">
              <span>Sesión:</span>
              <span className="text-[#c2c6d6] font-mono">SEC-9402</span>
            </div>
            <div className="flex justify-between">
              <span>Uptime:</span>
              <span className="text-[#c2c6d6] font-mono">14h 28m</span>
            </div>
            <div className="flex justify-between">
              <span>Estación:</span>
              <span className="text-[#c2c6d6] font-mono">WKST-01</span>
            </div>
          </div>

          <div className="mt-1 pt-1.5 border-t border-[#31353e] flex items-center justify-between font-mono text-[10px] text-[#8c909f]">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">schedule</span>
              <span>UTC-3</span>
            </span>
            <span className="text-[#dfe2ee] font-mono">{currentTime || '2026-09-13 15:40'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
