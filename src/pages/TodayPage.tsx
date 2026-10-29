import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Flame,
  Send,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useWorkspace } from '../app/workspace';
import { navigate } from '../app/router';
import { Avatar, Badge, Button, Card, EmptyState, KpiCard, LoadingBlock, Progress, SectionHeader, StatusBadge } from '../ui/kit';
import { ActivityFeed } from '../features/order-ui';
import {
  computeMemberLoad,
  dueLabel,
  greeting,
  isOverdue,
  pluralize,
  sortByAttention,
  todayLabel,
} from '../lib/helpers';

export function TodayPage() {
  const { orders, activity, stats, loading, session } = useWorkspace();

  const attention = useMemo(
    () => sortByAttention(orders.filter((order) => order.status !== 'finalizada')).slice(0, 6),
    [orders],
  );

  const teamLoad = useMemo(() => computeMemberLoad(orders).slice(0, 5), [orders]);
  const maxLoad = Math.max(1, ...teamLoad.map((entry) => entry.open));
  const unassigned = orders.filter((order) => !order.assignedTo && order.status !== 'finalizada').length;

  if (loading && orders.length === 0) {
    return <LoadingBlock rows={6} />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">{todayLabel()}</div>
          <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-tight text-[var(--txt)] mt-1 leading-tight">
            {greeting()}, {session.name.split(' ')[0]}.
          </h1>
          <p className="text-[13px] text-[var(--txt-2)] mt-1.5">
            {stats.pending > 0
              ? `Tenés ${pluralize(stats.pending, 'orden pendiente', 'órdenes pendientes')}${stats.overdue ? `, ${stats.overdue} vencida${stats.overdue === 1 ? '' : 's'}` : ''}.`
              : 'No hay órdenes pendientes. Todo el trabajo está cerrado.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={ClipboardList} onClick={() => navigate('/ordenes')}>
            Ver tablero
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Pendientes"
          value={stats.pending}
          hint={`${stats.byStatus.en_proceso} en proceso · ${stats.byStatus.recibida} sin abrir`}
          icon={ClipboardList}
          tone="blue"
        />
        <KpiCard
          label="Vencidas"
          value={stats.overdue}
          hint={stats.dueSoon ? `${stats.dueSoon} vencen en las próximas 24 h` : 'Sin vencimientos próximos'}
          icon={AlertTriangle}
          tone={stats.overdue > 0 ? 'red' : 'green'}
        />
        <KpiCard
          label="Urgentes activas"
          value={stats.urgent}
          hint={`${unassigned} sin responsable asignado`}
          icon={Flame}
          tone={stats.urgent > 0 ? 'amber' : 'green'}
        />
        <KpiCard
          label="Cumplimiento"
          value={`${stats.completionRate}%`}
          hint={`${stats.completed} de ${stats.total} cerradas · media ${stats.avgCompletionHours} h`}
          icon={TrendingUp}
          tone="green"
          footer={<Progress value={stats.completionRate} tone={stats.completionRate >= 70 ? 'green' : stats.completionRate >= 40 ? 'amber' : 'red'} />}
        />
      </div>

      {orders.length === 0 ? (
        <Card className="p-2">
          <EmptyState
            icon={ClipboardList}
            title="Arranquemos con la primera orden"
            description="Creá una orden, asignala a un integrante y el sistema la despachará automáticamente por Telegram con botones para actualizar el estado."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 items-start">
          {/* Atención */}
          <Card className="overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-[var(--line)]">
              <SectionHeader
                eyebrow="Prioridad operativa"
                title="Requiere tu atención"
                subtitle="Ordenado por vencimiento, prioridad y estado."
                action={
                  <Button variant="ghost" size="sm" iconRight={ArrowRight} onClick={() => navigate('/ordenes')}>
                    Ver todas
                  </Button>
                }
              />
            </div>

            {attention.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Todo bajo control"
                description="No quedan órdenes pendientes por atender."
                compact
              />
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {attention.map((order) => {
                  const due = dueLabel(order);
                  return (
                    <div
                      key={order.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--panel-2)]/60 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/ordenes/${order.id}`)}
                    >
                      <span
                        className="w-1 h-9 rounded-full shrink-0"
                        style={{ background: order.priority === 'urgente' ? 'var(--danger)' : order.priority === 'alta' ? 'var(--warn)' : 'var(--line-strong)' }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="mono text-[10px] text-[var(--txt-3)]">#{order.id}</span>
                          <StatusBadge status={order.status} />
                          {isOverdue(order) ? <Badge tone="red">Vencida</Badge> : null}
                        </div>
                        <div className="text-[13px] text-[var(--txt)] font-medium mt-1 truncate">{order.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {order.assignedTo ? (
                            <>
                              <Avatar name={order.assignedTo.name} color={order.assignedTo.color} size={16} />
                              <span className="text-[11px] text-[var(--txt-3)]">{order.assignedTo.name}</span>
                            </>
                          ) : (
                            <span className="text-[11px] text-[var(--warn)]">Sin asignar</span>
                          )}
                          <span
                            className="text-[11px] mono"
                            style={{ color: due.tone === 'red' ? '#ff93a0' : due.tone === 'amber' ? '#ffc971' : 'var(--txt-3)' }}
                          >
                            · {due.text}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/ordenes/${order.id}`);
                        }}
                      >
                        Abrir
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Columna derecha */}
          <div className="space-y-4">
            <Card className="p-4">
              <SectionHeader
                eyebrow="Capacidad"
                title="Carga del equipo"
                action={
                  <Button variant="ghost" size="sm" icon={Users} onClick={() => navigate('/equipo')}>
                    Equipo
                  </Button>
                }
              />
              <div className="mt-4 space-y-3">
                {teamLoad.length === 0 ? (
                  <p className="text-[12px] text-[var(--txt-3)]">Aún no hay órdenes asignadas.</p>
                ) : (
                  teamLoad.map((entry) => (
                    <button
                      key={entry.memberId}
                      type="button"
                      onClick={() => navigate(`/ordenes?member=${entry.memberId}`)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Avatar name={entry.name} color={entry.color} size={22} />
                        <span className="text-[12px] text-[var(--txt)] flex-1 truncate">{entry.name}</span>
                        <span className="mono text-[10px] text-[var(--txt-3)]">
                          {entry.open} abiertas
                          {entry.overdue > 0 ? <span className="text-[#ff93a0]"> · {entry.overdue} venc.</span> : null}
                        </span>
                      </div>
                      <Progress
                        value={(entry.open / maxLoad) * 100}
                        tone={entry.overdue > 0 ? 'red' : entry.open >= maxLoad ? 'amber' : 'blue'}
                      />
                    </button>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-4">
              <SectionHeader
                eyebrow="Trazabilidad"
                title="Actividad reciente"
                action={
                  <Button variant="ghost" size="sm" iconRight={ArrowRight} onClick={() => navigate('/auditoria')}>
                    Todo
                  </Button>
                }
              />
              <div className="mt-3">
                <ActivityFeed items={activity.slice(0, 5)} onOpenOrder={(id) => navigate(`/ordenes/${id}`)} />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Send size={14} className="text-[var(--cyan)]" />
                <span className="text-[12.5px] font-medium text-[var(--txt)]">Canal Telegram</span>
                <Badge tone={stats.byStatus.finalizada === stats.total && stats.total > 0 ? 'green' : 'blue'} className="ml-auto">
                  Espejo activo
                </Badge>
              </div>
              <p className="text-[11.5px] text-[var(--txt-2)] mt-2 leading-relaxed">
                Cada cambio de estado que hagas acá se refleja en los grupos y en los dispositivos conectados en tiempo real.
              </p>
              <Button variant="subtle" size="sm" className="mt-3 w-full" icon={Clock3} onClick={() => navigate('/telegram')}>
                Configurar recordatorios
              </Button>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
