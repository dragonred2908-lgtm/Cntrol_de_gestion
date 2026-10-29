import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Bot,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquarePlus,
  Send,
  Trash2,
  User,
} from 'lucide-react';
import { useWorkspace } from '../app/workspace';
import { navigate, useRoute } from '../app/router';
import { hasPermission } from '../lib/rbacConfig';
import { Avatar, Badge, Button, Card, EmptyState, LoadingBlock, PriorityBadge, SectionHeader, StatusBadge, Textarea } from '../ui/kit';
import { ActivityFeed, StatusStepper } from '../features/order-ui';
import { ConfirmModal, ReminderModal } from '../features/modals';
import { dueLabel, formatDateTime, isOverdue, STATUS_META, timeAgo } from '../lib/helpers';

export function OrderDetailPage() {
  const { route } = useRoute();
  const { orders, activity, setStatus, addNote, deleteOrder, loading, pushToast, flushing, session } = useWorkspace();
  const canManage = hasPermission(session.role, 'manage_orders');
  const canRemind = hasPermission(session.role, 'send_reminders');
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const order = useMemo(() => orders.find((item) => item.id === route.id), [orders, route.id]);
  const orderActivity = useMemo(
    () => (order ? activity.filter((item) => item.orderId === order.id) : []),
    [activity, order],
  );

  if (!order) {
    if (loading) return <LoadingBlock rows={6} />;
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="Orden no encontrada"
          description={`No existe una orden con el identificador ${route.id || '—'}. Puede haber sido eliminada.`}
          action={
            <Button variant="primary" icon={ArrowLeft} onClick={() => navigate('/ordenes')}>
              Volver al tablero
            </Button>
          }
        />
      </Card>
    );
  }

  const due = dueLabel(order);
  const next = STATUS_META[order.status].next;

  const submitNote = async () => {
    if (!note.trim()) return;
    setSavingNote(true);
    try {
      await addNote(order.id, note.trim());
      setNote('');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'No se pudo agregar la nota.', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => navigate('/ordenes')}
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--txt-2)] hover:text-[var(--txt)] transition-colors"
      >
        <ArrowLeft size={14} />
        Volver al tablero
      </button>

      {/* Header */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="mono text-[11px] text-[var(--txt-3)]">ORDEN #{order.id}</span>
              <StatusBadge status={order.status} />
              <PriorityBadge priority={order.priority} />
              {order.origin === 'telegram' ? (
                <Badge tone="cyan">
                  <Bot size={10} /> Telegram
                </Badge>
              ) : (
                <Badge tone="neutral">Panel web</Badge>
              )}
              {isOverdue(order) ? <Badge tone="red">Vencida</Badge> : null}
            </div>
            <h1 className="text-[21px] sm:text-[24px] font-semibold tracking-tight text-[var(--txt)] leading-tight">{order.title}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11.5px] text-[var(--txt-3)] mono">
              <span className="flex items-center gap-1">
                <Clock size={11} /> {due.text}
              </span>
              <span className="flex items-center gap-1">
                <CalendarClock size={11} /> Límite {formatDateTime(order.dueDate)}
              </span>
              <span>Creada {timeAgo(order.createdAt)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage ? (
              next ? (
                <Button variant="primary" icon={CheckCircle2} onClick={() => void setStatus(order.id, next)}>
                  Pasar a {STATUS_META[next].label}
                </Button>
              ) : (
                <Button variant="outline" onClick={() => void setStatus(order.id, 'en_proceso')}>
                  Reabrir
                </Button>
              )
            ) : null}
            {canRemind ? (
              <Button variant="outline" icon={Bell} onClick={() => setReminderOpen(true)}>
                Recordar
              </Button>
            ) : null}
            {canManage ? (
              <Button variant="ghost" size="md" iconOnly icon={Trash2} onClick={() => setDeleteOpen(true)} aria-label="Eliminar orden" />
            ) : null}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[var(--line)]">
          <StatusStepper status={order.status} onChange={(status) => void setStatus(order.id, status)} disabled={!canManage} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4 items-start">
        <div className="space-y-4">
          {/* Descripción */}
          <Card className="p-4">
            <SectionHeader eyebrow="Alcance" title="Descripción e instrucciones" />
            <p className="text-[13px] text-[var(--txt-2)] leading-relaxed mt-3 whitespace-pre-wrap">{order.description}</p>
          </Card>

          {/* Notas */}
          <Card className="p-4">
            <SectionHeader
              eyebrow="Seguimiento"
              title="Notas y observaciones"
              subtitle={`${order.notes?.length || 0} registro(s) técnico(s)`}
            />

            <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--bg-deep)] p-3">
              {canManage ? (
                <>
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    placeholder="Agregá una observación, avance o bloqueo…"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="hint">
                      {flushing ? 'Sincronizando cambios pendientes…' : 'Se registra en la auditoría con tu nombre.'}
                    </span>
                    <Button variant="primary" size="sm" icon={Send} onClick={submitNote} loading={savingNote} disabled={!note.trim()}>
                      Agregar nota
                    </Button>
                  </div>
                </>
              ) : (
                <span className="hint">Modo solo lectura: tu rol no permite agregar notas.</span>
              )}
            </div>

            <div className="mt-5">
              {order.notes && order.notes.length > 0 ? (
                <div className="timeline">
                  {[...order.notes].reverse().map((item) => (
                    <div key={item.id} className="timeline-item" data-tone="blue">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12px] font-medium text-[var(--txt)]">{item.author}</span>
                        <span className="mono text-[10px] text-[var(--txt-3)]">{formatDateTime(item.createdAt)}</span>
                      </div>
                      <p className="text-[12.5px] text-[var(--txt-2)] leading-relaxed mt-1 whitespace-pre-wrap">{item.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[12px] text-[var(--txt-3)] py-3">
                  <MessageSquarePlus size={14} />
                  Todavía no hay notas para esta orden.
                </div>
              )}
            </div>
          </Card>

          {/* Actividad */}
          <Card className="p-4">
            <SectionHeader eyebrow="Auditoría" title="Historial de la orden" />
            <div className="mt-3">
              <ActivityFeed items={orderActivity} />
            </div>
          </Card>
        </div>

        {/* Columna lateral */}
        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader eyebrow="Asignación" title="Responsable" />
            {order.assignedTo ? (
              <div className="flex items-center gap-3 mt-3">
                <Avatar name={order.assignedTo.name} color={order.assignedTo.color} size={40} />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-[var(--txt)] truncate">{order.assignedTo.name}</div>
                  <div className="text-[11.5px] text-[var(--txt-2)] truncate">{order.assignedTo.role}</div>
                  <div className="mono text-[11px] text-[var(--cyan)] mt-0.5">{order.assignedTo.telegramUser}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-3 text-[12px] text-[var(--warn)]">
                <User size={14} />
                Sin responsable asignado (se notifica al grupo).
              </div>
            )}
          </Card>

          <Card className="p-4">
            <SectionHeader eyebrow="Ficha" title="Datos de la orden" />
            <dl className="mt-3 space-y-2.5 text-[12px]">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--txt-3)] flex items-center gap-1.5">
                  <Building2 size={12} /> Área
                </dt>
                <dd className="text-[var(--txt)] text-right">{order.department || 'General'}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--txt-3)]">Creada por</dt>
                <dd className="text-[var(--txt)] text-right">{order.createdBy}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--txt-3)]">Fecha de creación</dt>
                <dd className="text-[var(--txt)] text-right mono text-[11px]">{formatDateTime(order.createdAt)}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--txt-3)]">Última actualización</dt>
                <dd className="text-[var(--txt)] text-right mono text-[11px]">{formatDateTime(order.updatedAt)}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--txt-3)]">Recordatorios</dt>
                <dd className="text-[var(--txt)] text-right mono text-[11px]">{order.remindersCount || 0}</dd>
              </div>
              {order.completedAt ? (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-[var(--txt-3)]">Cierre</dt>
                  <dd className="text-[#55e8b8] text-right mono text-[11px]">{formatDateTime(order.completedAt)}</dd>
                </div>
              ) : null}
              {order.telegramMessageId ? (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-[var(--txt-3)]">Mensaje Telegram</dt>
                  <dd className="text-[var(--cyan)] text-right mono text-[11px]">#{order.telegramMessageId}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Button variant="subtle" size="sm" icon={Bell} className="flex-1" onClick={() => setReminderOpen(true)} disabled={!canRemind}>
                Enviar recordatorio
              </Button>
            </div>
            <p className="hint mt-2">
              Se envía por Telegram al responsable con los botones de estado. Último envío:{' '}
              {order.lastReminderAt ? timeAgo(order.lastReminderAt) : 'nunca'}.
            </p>
          </Card>
        </div>
      </div>

      <ReminderModal open={reminderOpen} onClose={() => setReminderOpen(false)} order={order} />
      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Eliminar orden"
        description={`La orden #${order.id} y su historial dejarán de estar disponibles. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar definitivamente"
        danger
        onConfirm={async () => {
          await deleteOrder(order.id);
          navigate('/ordenes');
        }}
      />
    </div>
  );
}
