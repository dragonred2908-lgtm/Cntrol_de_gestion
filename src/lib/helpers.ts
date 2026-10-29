import { Order, OrderPriority, OrderStatus } from '../types';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* -------------------------------------------------------------------------- */
/* Workflow taxonomy                                                          */
/* -------------------------------------------------------------------------- */

export interface StatusMeta {
  label: string;
  short: string;
  tone: 'blue' | 'amber' | 'violet' | 'green';
  stripe: string;
  description: string;
  next: OrderStatus | null;
  icon: string;
}

export const STATUS_META: Record<OrderStatus, StatusMeta> = {
  recibida: {
    label: 'Recibida',
    short: 'Recibida',
    tone: 'blue',
    stripe: 'var(--accent)',
    description: 'Pendiente de toma de conocimiento',
    next: 'en_cuenta',
    icon: 'inbox',
  },
  en_cuenta: {
    label: 'En cuenta',
    short: 'En cuenta',
    tone: 'amber',
    stripe: 'var(--warn)',
    description: 'El responsable tomó conocimiento',
    next: 'en_proceso',
    icon: 'eye',
  },
  en_proceso: {
    label: 'En proceso',
    short: 'En proceso',
    tone: 'violet',
    stripe: 'var(--violet)',
    description: 'Trabajo en ejecución',
    next: 'finalizada',
    icon: 'loader',
  },
  finalizada: {
    label: 'Finalizada',
    short: 'Finalizada',
    tone: 'green',
    stripe: 'var(--ok)',
    description: 'Trabajo cerrado',
    next: null,
    icon: 'check',
  },
};

export const STATUS_ORDER: OrderStatus[] = ['recibida', 'en_cuenta', 'en_proceso', 'finalizada'];

export const PRIORITY_META: Record<
  OrderPriority,
  { label: string; tone: 'neutral' | 'blue' | 'amber' | 'red'; weight: number }
> = {
  baja: { label: 'Baja', tone: 'neutral', weight: 0 },
  media: { label: 'Media', tone: 'blue', weight: 1 },
  alta: { label: 'Alta', tone: 'amber', weight: 2 },
  urgente: { label: 'Urgente', tone: 'red', weight: 3 },
};

export const PRIORITIES: OrderPriority[] = ['baja', 'media', 'alta', 'urgente'];

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  if (diff < MINUTE) return 'hace instantes';
  if (diff < HOUR) return `hace ${Math.floor(diff / MINUTE)} min`;
  if (diff < DAY) return `hace ${Math.floor(diff / HOUR)} h`;
  if (diff < 7 * DAY) return `hace ${Math.floor(diff / DAY)} d`;
  return formatDate(iso);
}

export function isOverdue(order: Order): boolean {
  if (order.status === 'finalizada') return false;
  const due = new Date(order.dueDate).getTime();
  return !Number.isNaN(due) && due < Date.now();
}

export function isDueSoon(order: Order, hours = 24): boolean {
  if (order.status === 'finalizada') return false;
  const due = new Date(order.dueDate).getTime();
  if (Number.isNaN(due)) return false;
  const delta = due - Date.now();
  return delta >= 0 && delta <= hours * HOUR;
}

export function dueLabel(order: Order): { text: string; tone: 'neutral' | 'amber' | 'red' | 'green' } {
  if (order.status === 'finalizada') {
    return { text: `Cerrada ${timeAgo(order.completedAt || order.updatedAt)}`, tone: 'green' };
  }
  const due = new Date(order.dueDate).getTime();
  if (Number.isNaN(due)) return { text: 'Sin fecha', tone: 'neutral' };
  const delta = due - Date.now();
  const abs = Math.abs(delta);
  const span = abs < HOUR ? `${Math.max(1, Math.round(abs / MINUTE))} min` : abs < DAY ? `${Math.round(abs / HOUR)} h` : `${Math.round(abs / DAY)} d`;
  if (delta < 0) return { text: `Vencida hace ${span}`, tone: 'red' };
  if (delta < DAY) return { text: `Vence en ${span}`, tone: 'amber' };
  return { text: `Vence en ${span}`, tone: 'neutral' };
}

export function todayLabel(): string {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 13) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/* -------------------------------------------------------------------------- */
/* Metrics                                                                    */
/* -------------------------------------------------------------------------- */

export interface OrderStats {
  total: number;
  pending: number;
  overdue: number;
  dueSoon: number;
  urgent: number;
  completed: number;
  completionRate: number;
  avgCompletionHours: number;
  byStatus: Record<OrderStatus, number>;
}

export function computeStats(orders: Order[]): OrderStats {
  const byStatus: Record<OrderStatus, number> = {
    recibida: 0,
    en_cuenta: 0,
    en_proceso: 0,
    finalizada: 0,
  };

  let overdue = 0;
  let dueSoon = 0;
  let urgent = 0;
  let completionSum = 0;
  let completionCount = 0;

  for (const order of orders) {
    byStatus[order.status] = (byStatus[order.status] || 0) + 1;
    if (isOverdue(order)) overdue++;
    if (isDueSoon(order)) dueSoon++;
    if (order.priority === 'urgente' && order.status !== 'finalizada') urgent++;
    if (order.status === 'finalizada') {
      const created = new Date(order.createdAt).getTime();
      const done = new Date(order.completedAt || order.updatedAt).getTime();
      if (!Number.isNaN(created) && !Number.isNaN(done) && done > created) {
        completionSum += (done - created) / HOUR;
        completionCount++;
      }
    }
  }

  const total = orders.length;
  const completed = byStatus.finalizada;

  return {
    total,
    pending: total - completed,
    overdue,
    dueSoon,
    urgent,
    completed,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    avgCompletionHours: completionCount > 0 ? Math.round(completionSum / completionCount) : 0,
    byStatus,
  };
}

export interface MemberLoad {
  memberId: string;
  name: string;
  color: string;
  open: number;
  overdue: number;
  completed: number;
  total: number;
  completionRate: number;
}

export function computeMemberLoad(orders: Order[]): MemberLoad[] {
  const map = new Map<string, MemberLoad>();

  for (const order of orders) {
    if (!order.assignedTo) continue;
    const key = order.assignedTo.id;
    const entry =
      map.get(key) ||
      ({
        memberId: key,
        name: order.assignedTo.name,
        color: order.assignedTo.color || '#4d8dff',
        open: 0,
        overdue: 0,
        completed: 0,
        total: 0,
        completionRate: 0,
      } satisfies MemberLoad);

    entry.total++;
    if (order.status === 'finalizada') {
      entry.completed++;
    } else {
      entry.open++;
      if (isOverdue(order)) entry.overdue++;
    }
    map.set(key, entry);
  }

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      completionRate: entry.total > 0 ? Math.round((entry.completed / entry.total) * 100) : 0,
    }))
    .sort((a, b) => b.open - a.open || b.total - a.total);
}

export function attentionScore(order: Order): number {
  if (order.status === 'finalizada') return -1;
  let score = PRIORITY_META[order.priority].weight * 10;
  if (isOverdue(order)) score += 40;
  else if (isDueSoon(order)) score += 18;
  score += Math.max(0, 3 - STATUS_ORDER.indexOf(order.status)) * 3;
  return score;
}

export function sortByAttention(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    const diff = attentionScore(b) - attentionScore(a);
    if (diff !== 0) return diff;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                       */
/* -------------------------------------------------------------------------- */

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function colorFromName(name: string): string {
  const palette = ['#4d8dff', '#a78bfa', '#26d9a0', '#f7b23b', '#38bdf8', '#ff5d6c', '#f472b6'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function clampText(text: string, max = 120): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
