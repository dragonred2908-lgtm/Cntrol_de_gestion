import React, { useMemo, useState } from 'react';
import { Download, History, Search, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '../app/workspace';
import { Badge, Button, Card, EmptyState, SectionHeader, Select } from '../ui/kit';
import { ActivityFeed } from '../features/order-ui';
import { downloadJson } from '../lib/helpers';
import { navigate } from '../app/router';

const TYPES: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todos los eventos' },
  { value: 'order_created', label: 'Órdenes creadas' },
  { value: 'status_change', label: 'Cambios de estado / notas' },
  { value: 'reminder_sent', label: 'Recordatorios' },
  { value: 'telegram_sync', label: 'Telegram' },
  { value: 'member', label: 'Equipo' },
  { value: 'security', label: 'Seguridad' },
];

export function AuditPage() {
  const { activity, pushToast } = useWorkspace();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return activity.filter((item) => {
      if (type !== 'all' && item.type !== type) return false;
      if (!needle) return true;
      return `${item.actor} ${item.action} ${item.details} ${item.orderId || ''} ${item.orderTitle || ''}`
        .toLowerCase()
        .includes(needle);
    });
  }, [activity, search, type]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Trazabilidad</div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--txt)] mt-1">Auditoría</h1>
          <p className="text-[12.5px] text-[var(--txt-2)] mt-1">
            Registro inmutable de acciones humanas, del bot y del sistema ({activity.length} eventos).
          </p>
        </div>
        <Button
          variant="outline"
          icon={Download}
          onClick={() => {
            downloadJson(`auditoria_${new Date().toISOString().split('T')[0]}.json`, filtered);
            pushToast('Registro de auditoría exportado.', 'success');
          }}
        >
          Exportar JSON
        </Button>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--txt-3)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por actor, orden o detalle…"
              className="input h-9 pl-9"
            />
          </div>
          <Select value={type} onChange={(event) => setType(event.target.value)} className="h-9 w-full sm:w-[240px]">
            {TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Badge tone="neutral">{filtered.length} eventos</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        <Card className="p-4">
          <SectionHeader eyebrow="Línea de tiempo" title="Eventos registrados" subtitle="Más recientes primero." />
          <div className="mt-4">
            {filtered.length === 0 ? (
              <EmptyState icon={History} title="Sin eventos" description="No hay actividad que coincida con el filtro." compact />
            ) : (
              <ActivityFeed items={filtered} onOpenOrder={(id) => navigate(`/ordenes/${id}`)} />
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader eyebrow="Resumen" title="Distribución por tipo" />
            <div className="mt-3 space-y-2">
              {TYPES.filter((option) => option.value !== 'all').map((option) => {
                const count = activity.filter((item) => item.type === option.value).length;
                const pct = activity.length ? Math.round((count / activity.length) * 100) : 0;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setType(option.value)}
                    className="w-full flex items-center justify-between gap-3 text-left group"
                  >
                    <span className="text-[12px] text-[var(--txt-2)] group-hover:text-[var(--txt)] truncate">{option.label}</span>
                    <span className="mono text-[10.5px] text-[var(--txt-3)]">{count} · {pct}%</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-[#55e8b8]" />
              <span className="text-[12.5px] font-medium text-[var(--txt)]">Integridad del registro</span>
            </div>
            <p className="hint mt-2">
              Cada cambio de estado, nota o recordatorio se persiste en `data/database.json` y se replica por WebSocket y SSE.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
