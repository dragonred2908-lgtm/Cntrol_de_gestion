import React, { useMemo, useState } from 'react';
import { ArrowRight, Mail, Plus, RefreshCw, Send, UserPlus, Users } from 'lucide-react';
import { useWorkspace } from '../app/workspace';
import { navigate } from '../app/router';
import { hasPermission } from '../lib/rbacConfig';
import { Avatar, Badge, Button, Card, EmptyState, Progress, SectionHeader } from '../ui/kit';
import { AddMemberModal } from '../features/modals';
import { computeMemberLoad, computeStats, timeAgo } from '../lib/helpers';

export function TeamPage() {
  const { members, orders, loading, session, syncMembers, pushToast } = useWorkspace();
  const canManageTeam = hasPermission(session.role, 'manage_orders');
  const canSync = hasPermission(session.role, 'sync_members');
  const [addOpen, setAddOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncMembers();
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'No se pudo sincronizar con Telegram.',
        'error',
      );
    } finally {
      setSyncing(false);
    }
  };

  const loads = useMemo(() => computeMemberLoad(orders), [orders]);
  const stats = useMemo(() => computeStats(orders), [orders]);
  const loadByMember = useMemo(() => new Map(loads.map((entry) => [entry.memberId, entry])), [loads]);
  const unassigned = orders.filter((order) => !order.assignedTo && order.status !== 'finalizada');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Talento operativo</div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--txt)] mt-1">Equipo</h1>
          <p className="text-[12.5px] text-[var(--txt-2)] mt-1">
            {members.length} integrantes · {stats.pending} órdenes abiertas en total
            {unassigned.length > 0 ? ` · ${unassigned.length} sin asignar` : ''}.
          </p>
        </div>
        {canManageTeam || canSync ? (
          <div className="flex flex-wrap items-center gap-2">
            {canSync ? (
              <Button variant="outline" icon={RefreshCw} loading={syncing} onClick={handleSync}>
                Sincronizar Telegram
              </Button>
            ) : null}
            {canManageTeam ? (
              <Button variant="primary" icon={UserPlus} onClick={() => setAddOpen(true)}>
                Sumar integrante
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Integrantes', value: members.length, hint: 'registrados en el sistema' },
          { label: 'Activos', value: members.filter((member) => member.status === 'activo').length, hint: 'disponibles para asignación' },
          { label: 'Con carga', value: loads.filter((entry) => entry.open > 0).length, hint: 'con órdenes abiertas' },
          { label: 'Sin asignar', value: unassigned.length, hint: 'órdenes abiertas sin responsable' },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <div className="eyebrow">{item.label}</div>
            <div className="mono text-[24px] font-semibold text-[var(--txt)] mt-2 leading-none">{item.value}</div>
            <div className="text-[11px] text-[var(--txt-3)] mt-1.5">{item.hint}</div>
          </Card>
        ))}
      </div>

      {loading && members.length === 0 ? (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[1, 2, 3].map((index) => (
              <div key={index} className="skeleton h-44" />
            ))}
          </div>
        </Card>
      ) : members.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Todavía no hay integrantes"
            description="Sumá a tu equipo para poder asignar órdenes y enviar recordatorios por Telegram."
            action={
              canManageTeam ? (
                <Button variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>
                  Sumar integrante
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {members.map((member) => {
            const load = loadByMember.get(member.id);
            const total = load?.total || 0;
            return (
              <Card key={member.id} className="p-4 card-interactive" interactive>
                <div className="flex items-start gap-3">
                  <Avatar name={member.name} color={member.color} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13.5px] font-medium text-[var(--txt)] truncate">{member.name}</h3>
                      <Badge tone={member.status === 'activo' ? 'green' : member.status === 'ausente' ? 'amber' : 'neutral'}>
                        {member.status}
                      </Badge>
                    </div>
                    <div className="text-[11.5px] text-[var(--txt-2)] truncate mt-0.5">{member.role}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className="mono text-[10.5px] text-[var(--cyan)] flex items-center gap-1">
                        <Send size={10} />
                        {member.telegramUser}
                      </span>
                      {member.email ? (
                        <span className="text-[10.5px] text-[var(--txt-3)] flex items-center gap-1 truncate">
                          <Mail size={10} />
                          {member.email}
                        </span>
                      ) : null}
                      {member.lastSeenAt ? (
                        <span className="text-[10.5px] text-[var(--txt-3)]">
                          visto {timeAgo(member.lastSeenAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="panel-inset px-2 py-1.5">
                    <div className="mono text-[15px] text-[var(--txt)] leading-none">{load?.open || 0}</div>
                    <div className="text-[9.5px] text-[var(--txt-3)] mt-1 uppercase tracking-wide">Abiertas</div>
                  </div>
                  <div className="panel-inset px-2 py-1.5">
                    <div className="mono text-[15px] text-[#55e8b8] leading-none">{load?.completed || 0}</div>
                    <div className="text-[9.5px] text-[var(--txt-3)] mt-1 uppercase tracking-wide">Cerradas</div>
                  </div>
                  <div className="panel-inset px-2 py-1.5">
                    <div className="mono text-[15px] leading-none" style={{ color: (load?.overdue || 0) > 0 ? '#ff93a0' : 'var(--txt)' }}>
                      {load?.overdue || 0}
                    </div>
                    <div className="text-[9.5px] text-[var(--txt-3)] mt-1 uppercase tracking-wide">Vencidas</div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10.5px] text-[var(--txt-3)] mb-1.5">
                    <span>Cumplimiento</span>
                    <span className="mono">{load?.completionRate || 0}% de {total}</span>
                  </div>
                  <Progress
                    value={load?.completionRate || 0}
                    tone={(load?.completionRate || 0) >= 70 ? 'green' : (load?.completionRate || 0) >= 40 ? 'amber' : 'red'}
                  />
                </div>

                <Button
                  variant="subtle"
                  size="sm"
                  className="w-full mt-3"
                  iconRight={ArrowRight}
                  onClick={() => navigate(`/ordenes?member=${member.id}`)}
                >
                  Ver órdenes
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {unassigned.length > 0 ? (
        <Card className="p-4">
          <SectionHeader
            eyebrow="Atención"
            title="Órdenes sin responsable"
            subtitle={`${unassigned.length} orden(es) abiertas notifican al grupo general de Telegram.`}
            action={
              <Button variant="outline" size="sm" iconRight={ArrowRight} onClick={() => navigate('/ordenes')}>
                Ir al tablero
              </Button>
            }
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {unassigned.slice(0, 8).map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => navigate(`/ordenes/${order.id}`)}
                className="text-left rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 hover:border-[var(--line-strong)] transition-colors max-w-[280px]"
              >
                <div className="mono text-[10px] text-[var(--txt-3)]">#{order.id}</div>
                <div className="text-[12px] text-[var(--txt)] truncate">{order.title}</div>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
