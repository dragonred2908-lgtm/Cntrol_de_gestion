import React from 'react';
import { ShieldAlert, Send, Lock, ArrowRight, ExternalLink, RefreshCw } from 'lucide-react';
import { UserSession, TelegramConfig } from '../types';
import { Permission, hasPermission, canAccessWebUI, RBAC_MATRIX } from '../lib/rbacConfig';

interface ProtectedRouteProps {
  session: UserSession;
  requiredPermission?: Permission;
  telegramConfig?: TelegramConfig;
  onRequestAuth: () => void;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  session,
  requiredPermission,
  telegramConfig,
  onRequestAuth,
  children,
}) => {
  // 1. Operador: Bloqueo de UI Web completa -> Redirigir al portal de Telegram
  if (session.role === 'operator' || !canAccessWebUI(session.role)) {
    const botUser = telegramConfig?.botUsername || '@nucleo_control_bot';
    const groupLink = telegramConfig?.groupChatId || '-1002692322280';

    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#181c24] border border-[#31353e] rounded-2xl p-6 shadow-2xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#229ed9]/15 border border-[#229ed9]/30 text-[#229ed9] flex items-center justify-center mx-auto mb-4">
            <Send className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#229ed9]/10 border border-[#229ed9]/25 text-[#229ed9] text-xs font-mono mb-3">
            <span>CANAL EXCLUSIVO PARA OPERADORES</span>
          </div>

          <h2 className="text-xl font-bold text-[#dfe2ee] mb-2">
            Interacción Operativa vía Telegram
          </h2>

          <p className="text-xs text-[#8c909f] leading-relaxed mb-6">
            Los operadores y especialistas de campo no requieren acceso a la consola web. 
            Todas las órdenes asignadas, alertas de vencimiento y confirmaciones de estado se gestionan directamente en el Bot oficial de Telegram con botones táctiles inmediatos.
          </p>

          <div className="bg-[#0a0e16] border border-[#31353e]/60 rounded-xl p-4 mb-6 text-left font-mono text-xs space-y-3">
            <div className="flex items-center justify-between text-[#dfe2ee]">
              <span className="text-[#8c909f]">Bot Oficial:</span>
              <a
                href={`https://t.me/${botUser.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                className="text-[#60a5fa] hover:underline flex items-center gap-1 font-bold"
              >
                <span>{botUser}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center justify-between text-[#dfe2ee]">
              <span className="text-[#8c909f]">Flujo de Trabajo:</span>
              <span className="text-[#34d399]">3 Botones Táctiles</span>
            </div>

            <div className="pt-2 border-t border-[#31353e]/40 grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <span className="py-1 px-1.5 rounded bg-[#181c24] border border-[#60a5fa]/30 text-[#60a5fa]">
                📥 En Cuenta
              </span>
              <span className="py-1 px-1.5 rounded bg-[#181c24] border border-[#fbbf24]/30 text-[#fbbf24]">
                ⏳ En Proceso
              </span>
              <span className="py-1 px-1.5 rounded bg-[#181c24] border border-[#34d399]/30 text-[#34d399]">
                ✅ Finalizada
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <a
              href={`https://t.me/${botUser.replace('@', '')}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-[#229ed9] hover:bg-[#1c8ec4] text-white font-medium text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-[#229ed9]/20 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Abrir Bot en Telegram</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={onRequestAuth}
              className="w-full py-2 px-4 rounded-xl bg-[#1c2028] hover:bg-[#262a33] text-[#8c909f] hover:text-[#dfe2ee] border border-[#31353e]/50 font-mono text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Ingresar como Administrador (PIN)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Verificación de permiso específico
  if (requiredPermission && !hasPermission(session.role, requiredPermission)) {
    const roleInfo = RBAC_MATRIX[session.role];

    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#181c24] border border-[#ef4444]/30 rounded-2xl p-6 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-[#ef4444]/15 text-[#f87171] border border-[#ef4444]/30 flex items-center justify-center mx-auto mb-3">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <h3 className="text-base font-bold text-[#dfe2ee] mb-1">
            Acceso Restringido por Rol
          </h3>

          <p className="text-xs text-[#8c909f] mb-4">
            Tu rol actual ({roleInfo.title}) no tiene autorización para acceder al recurso:{' '}
            <code className="text-[#f87171] font-mono">{requiredPermission}</code>.
          </p>

          <button
            type="button"
            onClick={onRequestAuth}
            className="w-full py-2.5 px-4 rounded-xl bg-[#4d8eff] hover:bg-[#adc6ff] hover:text-[#002e6a] text-[#00285d] font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer font-mono"
          >
            <Lock className="w-4 h-4" />
            <span>Desbloquear con PIN de Administrador / Desarrollador</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
