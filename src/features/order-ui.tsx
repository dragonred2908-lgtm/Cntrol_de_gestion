import React from 'react';
import {
  ArrowRight,
  BellRing,
  Bot,
  Check,
  CircleDot,
  Clock,
  FileText,
  MessageSquare,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { ActivityLog, Order, OrderStatus } from '../types';
import { Avatar, Badge, PriorityBadge, StatusBadge } from '../ui/kit';
import { cn, dueLabel, PRIORITY_META, STATUS_META, STATUS_ORDER, timeAgo } from '../lib/helpers';

/* -------------------------------------------------------------------------- */
/* Order card                                                                 */
/* -------------------------------------------------------------------------- */

export function OrderCard({
  order,
  onOpen,
  onAdvance,
  draggable,
  onDragStart,
  compact,
}: {
  order: Order;
  onOpen: (order: Order) => void;
  onAdvance?: (order: Order, status: OrderStatus) => void;
  draggable?: boolean;
  onDragStart?: (event: React.DragEvent, order: Order) => void;
  compact?: boolean;
}) {
  const due = dueLabel(order);
  const next = STATUS_META[order.status].next;
  const notes = order.notes?.length || 0;

  return (
    <article
      className="order-card group"
      style={{ ['--stripe' as string]: STATUS_META[order.status].stripe }}
      draggable={draggable}
      onDragStart={(event) => onDragStart?.(event, order)}
      onClick={() => onOpen(order)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(order);
        }
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="mono text-[10px] text-[var(--txt-3)] tracking-wide">#{order.id}</span>
        <div className="flex items-center gap-1.5">
          {order.origin === 'telegram' ? (
            <Bot size={12} className="text-[var(--cyan)]" aria-label="Originada en Telegram" />
          ) : null}
          <PriorityBadge priority={order.priority} />
        </div>
      </div>

      <h4 className="text-[13px] font-medium text-[var(--txt)] leading-snug clamp-2 pr-1">{order.title}</h4>

      {!compact ? (
        <p className="text-[11.5px] text-[var(--txt-3)] leading-relaxed mt-1.5 clamp-2">{order.description}</p>
      ) : null}

      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[var(--line)]">
        <div className="flex items-center gap-1.5 min-w-0">
          {order.assignedTo ? (
            <>
              <Avatar name={order.assignedTo.name} color={order.assignedTo.color} size={20} />
              <span className="text-[11px] text-[var(--txt-2)] truncate">{order.assignedTo.name.split(' ')[0]}</span>
            </>
          ) : (
            <Badge tone="neutral">Sin asignar</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {notes > 0 ? (
            <span className="flex items-center gap-0.5 mono text-[10px] text-[var(--txt-3)]">
              <MessageSquare size={10} />
              {notes}
            </span>
          ) : null}
          <span
            className={cn(
              'flex items-center gap-1 mono text-[10px]',
              due.tone === 'red' && 'text-[#ff93a0]',
              due.tone === 'amber' && 'text-[#ffc971]',
              due.tone === 'green' && 'text-[#55e8b8]',
              due.tone === 'neutral' && 'text-[var(--txt-3)]',
            )}
          >
            <Clock size={10} />
            {due.text}
          </span>
        </div>
      </div>

      {next ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAdvance?.(order, next);
          }}
          className="absolute right-2 top-8 opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2 rounded-md bg-[var(--panel)] border border-[var(--line-strong)] text-[10px] mono text-[var(--txt-2)] hover:text-[var(--txt)] hover:border-[var(--accent)] flex items-center gap-1"
          title={`Avanzar a ${STATUS_META[next].label}`}
        >
          <ArrowRight size={11} />
          {STATUS_META[next].short}
        </button>
      ) : null}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Status stepper                                                             */
/* -------------------------------------------------------------------------- */

export function StatusStepper({
  status,
  onChange,
  disabled,
}: {
  status: OrderStatus;
  onChange: (next: OrderStatus) => void;
  disabled?: boolean;
}) {
  const currentIndex = STATUS_ORDER.indexOf(status);
  const icons = [CircleDot, Check, Clock, Check];

  return (
    <div className="flex items-center w-full">
      {STATUS_ORDER.map((step, index) => {
        const meta = STATUS_META[step];
        const Icon = icons[index];
        const done = index < currentIndex;
        const active = index === currentIndex;
        const reachable = !disabled && index !== currentIndex;

        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onChange(step)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors shrink-0',
                reachable && 'hover:bg-[var(--panel-2)] cursor-pointer',
                !reachable && 'cursor-default',
              )}
              title={reachable ? `Marcar como ${meta.label}` : meta.description}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center border text-[10px] shrink-0"
                style={{
                  background: active ? meta.stripe : done ? 'rgba(38,217,160,0.12)' : 'var(--panel-2)',
                  borderColor: active ? meta.stripe : done ? 'rgba(38,217,160,0.4)' : 'var(--line-strong)',
                  color: active ? '#06101f' : done ? '#55e8b8' : 'var(--txt-3)',
                }}
              >
                {done ? <Check size={12} strokeWidth={3} /> : <Icon size={12} />}
              </span>
              <span
                className={cn(
                  'text-[11.5px] hidden sm:block whitespace-nowrap',
                  active ? 'text-[var(--txt)] font-medium' : done ? 'text-[#55e8b8]' : 'text-[var(--txt-3)]',
                )}
              >
                {meta.label}
              </span>
            </button>
            {index < STATUS_ORDER.length - 1 ? (
              <span className="flex-1 h-px mx-1.5 min-w-3" style={{ background: index < currentIndex ? 'rgba(38,217,160,0.35)' : 'var(--line-strong)' }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Activity feed                                                              */
/* -------------------------------------------------------------------------- */

const ACTIVITY_ICON: Record<ActivityLog['type'], React.ElementType> = {
  order_created: FileText,
  status_change: CircleDot,
  assigned: Users,
  reminder_sent: BellRing,
  telegram_sync: Bot,
  security: ShieldAlert,
  member: Users,
};

const ACTIVITY_TONE: Record<ActivityLog['type'], string> = {
  order_created: 'blue',
  status_change: 'amber',
  assigned: 'violet',
  reminder_sent: 'amber',
  telegram_sync: 'cyan',
  security: 'red',
  member: 'green',
};

export function ActivityFeed({ items, onOpenOrder }: { items: ActivityLog[]; onOpenOrder?: (orderId: string) => void }) {
  if (items.length === 0) {
    return <p className="text-[12px] text-[var(--txt-3)] py-4">Todavía no hay actividad registrada.</p>;
  }

  return (
    <div className="timeline">
      {items.map((item) => {
        const Icon = ACTIVITY_ICON[item.type] || CircleDot;
        const tone = ACTIVITY_TONE[item.type] || 'blue';
        return (
          <div key={item.id} className="timeline-item" data-tone={tone}>
            <div className="flex items-start gap-2">
              <Icon size={13} className="mt-0.5 text-[var(--txt-3)] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[12.5px] font-medium text-[var(--txt)]">{item.action}</span>
                  {item.orderId && onOpenOrder ? (
                    <button
                      type="button"
                      onClick={() => onOpenOrder(item.orderId!)}
                      className="mono text-[10px] text-[var(--accent-2)] hover:underline"
                    >
                      #{item.orderId}
                    </button>
                  ) : null}
                </div>
                <p className="text-[11.5px] text-[var(--txt-2)] leading-relaxed mt-0.5">{item.details}</p>
                <div className="mono text-[10px] text-[var(--txt-3)] mt-1">
                  {item.actor} · {timeAgo(item.timestamp)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Priority bar                                                               */
/* -------------------------------------------------------------------------- */

export function PriorityBars({ order }: { order: Order }) {
  const weight = PRIORITY_META[order.priority].weight + 1;
  return (
    <span className="inline-flex items-end gap-[2px]" title={`Prioridad ${PRIORITY_META[order.priority].label}`}>
      {[1, 2, 3, 4].map((level) => (
        <span
          key={level}
          className="w-[3px] rounded-sm"
          style={{
            height: 4 + level * 2,
            background: level <= weight ? STATUS_META[order.status].stripe : 'var(--line-strong)',
          }}
        />
      ))}
    </span>
  );
}

export { StatusBadge };
