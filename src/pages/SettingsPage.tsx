import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Database,
  HardDriveDownload,
  LogOut,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  Wifi,
} from 'lucide-react';
import { useWorkspace } from '../app/workspace';
import { api } from '../lib/api';
import { Avatar, Badge, Button, Card, SectionHeader } from '../ui/kit';
import { ConfirmModal } from '../features/modals';
import { RBAC_MATRIX, hasPermission } from '../lib/rbacConfig';
import { cn, formatDateTime, timeAgo } from '../lib/helpers';
import { UserRole } from '../types';

export function SettingsPage() {
  const {
    session,
    signOut,
    socketConnected,
    sseConnected,
    sseClients,
    deviceCount,
    queueLength,
    flushing,
    flushQueue,
    lastSyncAt,
    resetData,
    refresh,
    pushToast,
    orders,
    members,
    activity,
  } = useWorkspace();

  const [health, setHealth] = useState<{ status: string; ordersCount: number; telegramStatus: string; uptime: number } | null>(null);
  const [persistence, setPersistence] = useState<Record<string, unknown> | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [healthResult, persistenceResult] = await Promise.allSettled([api.health(), api.persistence.status()]);
        if (!alive) return;
        if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
        if (persistenceResult.status === 'fulfilled') setPersistence(persistenceResult.value);
      } catch {
        /* silent */
      }
    })();
    return () => {
      alive = false;
    };
  }, [reloading]);

  const roleInfo = RBAC_MATRIX[session.role];
  const healthTone = health ? 'green' : 'red';
  const canReset = hasPermission(session.role, 'reset_database');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Configuración</div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--txt)] mt-1">Ajustes</h1>
          <p className="text-[12.5px] text-[var(--txt-2)] mt-1">Sesión, estado del sistema y persistencia de datos.</p>
        </div>
        <Button
          variant="outline"
          icon={RefreshCw}
          loading={reloading}
          onClick={async () => {
            setReloading(true);
            await refresh();
            setReloading(false);
            pushToast('Estado actualizado.', 'info');
          }}
        >
          Refrescar estado
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="space-y-4">
          {/* Sesión */}
          <Card className="p-4">
            <SectionHeader eyebrow="Cuenta" title="Sesión actual" />
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <Avatar name={session.name} color="#4d8dff" size={46} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-[var(--txt)]">{session.name}</div>
                <div className="text-[12px] text-[var(--txt-2)]">{roleInfo?.title || session.role}</div>
                <div className="text-[11px] text-[var(--txt-3)] mt-0.5">{roleInfo?.description}</div>
              </div>
              <Badge tone={session.role === 'admin' ? 'blue' : session.role === 'developer' ? 'violet' : 'neutral'}>
                {session.role}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <Button variant="outline" icon={LogOut} onClick={signOut}>
                Cerrar sesión
              </Button>
              <Button variant="ghost" icon={Users} onClick={() => (window.location.hash = '#/equipo')}>
                Gestionar equipo
              </Button>
            </div>
          </Card>

          {/* Roles */}
          <Card className="p-4">
            <SectionHeader eyebrow="Acceso" title="Matriz de roles" subtitle="Permisos efectivos según el rol activo." />
            <div className="mt-3 overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rol</th>
                    <th>Acceso web</th>
                    <th className="hidden sm:table-cell">Gestión</th>
                    <th className="hidden md:table-cell">Config. Telegram</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(RBAC_MATRIX) as UserRole[]).map((role) => {
                    const info = RBAC_MATRIX[role];
                    const isCurrent = role === session.role;
                    return (
                      <tr key={role} className={cn('cursor-default', isCurrent && 'bg-[var(--accent-soft)]/40')}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className={cn('text-[12.5px]', isCurrent ? 'text-[var(--accent-2)] font-medium' : 'text-[var(--txt)]')}>
                              {info.title}
                            </span>
                            {isCurrent ? <Badge tone="blue">Actual</Badge> : null}
                          </div>
                        </td>
                        <td>
                          {info.permissions.includes('web_access') ? <CheckCircle2 size={14} className="text-[#55e8b8]" /> : <span className="text-[var(--txt-3)] text-[11px]">Solo Telegram</span>}
                        </td>
                        <td className="hidden sm:table-cell">
                          {info.permissions.includes('manage_orders') ? <CheckCircle2 size={14} className="text-[#55e8b8]" /> : <span className="text-[var(--txt-3)]">—</span>}
                        </td>
                        <td className="hidden md:table-cell">
                          {info.permissions.includes('configure_telegram') ? <CheckCircle2 size={14} className="text-[#55e8b8]" /> : <span className="text-[var(--txt-3)]">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="hint mt-3">
              Para cambiar de rol, cerrá sesión e ingresá con el PIN correspondiente. Los operadores no acceden a la interfaz web.
            </p>
          </Card>

          {/* Persistencia */}
          <Card className="p-4">
            <SectionHeader eyebrow="Datos" title="Persistencia y sincronización" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
              {[
                { label: 'Órdenes en memoria', value: String(orders.length), icon: Database },
                { label: 'Integrantes', value: String(members.length), icon: Users },
                { label: 'Eventos', value: String(activity.length), icon: Activity },
                { label: 'Cola offline', value: String(queueLength), icon: HardDriveDownload },
                { label: 'Dispositivos', value: String(deviceCount), icon: Wifi },
                { label: 'Clientes SSE', value: String(sseClients), icon: Server },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="panel-inset px-2.5 py-2">
                    <div className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-wide text-[var(--txt-3)]">
                      <Icon size={10} />
                      {item.label}
                    </div>
                    <div className="mono text-[13px] text-[var(--txt)] mt-1">{item.value}</div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Button variant="outline" icon={RefreshCw} onClick={() => void flushQueue()} loading={flushing} disabled={queueLength === 0}>
                Sincronizar cola ({queueLength})
              </Button>
              <span className="text-[11px] text-[var(--txt-3)]">Última sincronización: {lastSyncAt ? timeAgo(lastSyncAt) : 'sin registro'}</span>
            </div>

            {persistence ? (
              <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-[var(--line)] bg-[var(--bg-deep)] p-3 mono text-[10.5px] text-[var(--txt-2)]">
                {JSON.stringify(persistence, null, 2)}
              </pre>
            ) : null}
          </Card>
        </div>

        <div className="space-y-4">
          {/* Salud */}
          <Card className="p-4">
            <SectionHeader
              eyebrow="Infraestructura"
              title="Estado del servidor"
              action={<Badge tone={healthTone} dot>{health ? 'Operativo' : 'Sin respuesta'}</Badge>}
            />
            <div className="mt-3 space-y-2.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--txt-3)] flex items-center gap-1.5">
                  <Server size={12} /> API Express
                </span>
                <span className={health ? 'text-[#55e8b8]' : 'text-[#ff93a0]'}>{health ? `OK · ${Math.round(health.uptime)}s uptime` : 'sin respuesta'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--txt-3)] flex items-center gap-1.5">
                  <Wifi size={12} /> WebSocket
                </span>
                <span className={socketConnected ? 'text-[#55e8b8]' : 'text-[#ff93a0]'}>{socketConnected ? 'conectado' : 'desconectado'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--txt-3)] flex items-center gap-1.5">
                  <Activity size={12} /> SSE
                </span>
                <span className={sseConnected ? 'text-[#55e8b8]' : 'text-[#ff93a0]'}>{sseConnected ? 'conectado' : 'desconectado'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--txt-3)] flex items-center gap-1.5">
                  <Clock size={12} /> Telegram
                </span>
                <span className="text-[var(--txt-2)]">{health?.telegramStatus || '—'}</span>
              </div>
            </div>
            <p className="hint mt-3">Servidor: Express + Socket.IO. Datos en `data/database.json` con cola FIFO offline.</p>
          </Card>

          {/* Seguridad */}
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-[#55e8b8]" />
              <span className="text-[12.5px] font-medium text-[var(--txt)]">Seguridad</span>
            </div>
            <ul className="mt-2 space-y-1.5 text-[11.5px] text-[var(--txt-2)] leading-relaxed">
              <li>• El PIN de administrador se valida en el servidor.</li>
              <li>• El token del bot nunca se muestra completo en la interfaz.</li>
              <li>• Las acciones quedan auditadas con autor y fecha.</li>
            </ul>
          </Card>

          {/* Peligro */}
          <Card className="p-4 border-[rgba(255,93,108,0.25)]">
            <div className="flex items-center gap-2">
              <ShieldAlert size={15} className="text-[#ff93a0]" />
              <span className="text-[12.5px] font-medium text-[var(--txt)]">Zona de riesgo</span>
            </div>
            <p className="text-[11.5px] text-[var(--txt-2)] mt-2 leading-relaxed">
              Restaura la base a su estado inicial: elimina todas las órdenes, el historial y la configuración de Telegram.
            </p>
            <Button variant="danger" icon={Trash2} className="w-full mt-3" onClick={() => setResetOpen(true)} disabled={!canReset}>
              Restablecer todos los datos
            </Button>
            {!canReset ? <p className="hint mt-2">Solo Administrador y Desarrollo pueden restablecer la base.</p> : null}
          </Card>

          <Card className="p-4">
            <div className="text-[11px] text-[var(--txt-3)] mono space-y-1">
              <div>NÚCLEO CONTROL · v3.0</div>
              <div>Interfaz: React + Vite</div>
              <div>Backend: Express + Socket.IO + SSE</div>
              <div>Última consulta: {formatDateTime(new Date().toISOString())}</div>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Restablecer todos los datos"
        description="Se eliminarán todas las órdenes y el historial, y se borrará la configuración de Telegram. Esta acción no se puede deshacer."
        confirmLabel="Sí, restablecer"
        danger
        onConfirm={resetData}
      />
    </div>
  );
}
