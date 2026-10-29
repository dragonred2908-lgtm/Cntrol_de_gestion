import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Filter,
  KanbanSquare,
  List,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useWorkspace } from '../app/workspace';
import { navigate, setQueryParam, useRoute } from '../app/router';
import { hasPermission } from '../lib/rbacConfig';
import { Avatar, Badge, Button, Card, EmptyState, PriorityBadge, Segmented, Select, StatusBadge } from '../ui/kit';
import { OrderCard } from '../features/order-ui';
import { cn, dueLabel, isOverdue, PRIORITIES, PRIORITY_META, STATUS_META, STATUS_ORDER } from '../lib/helpers';
import { OrderStatus } from '../types';

type ViewMode = 'board' | 'list';

export function OrdersPage() {
  const { orders, members, setStatus, loading, session } = useWorkspace();
  const { route } = useRoute();
  const canManage = hasPermission(session.role, 'manage_orders');

  const [view, setView] = useState<ViewMode>(() => (window.innerWidth < 768 ? 'list' : 'board'));
  const [search, setSearch] = useState(route.query.get('q') || '');
  const [priority, setPriority] = useState(route.query.get('priority') || 'all');
  const [memberId, setMemberId] = useState(route.query.get('member') || 'all');
  const [onlyOverdue, setOnlyOverdue] = useState(route.query.get('overdue') === '1');
  const [showFilters, setShowFilters] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<OrderStatus | null>(null);

  // Sincroniza la búsqueda cuando llega desde el buscador global
  const externalQuery = route.query.get('q') || '';
  useEffect(() => {
    setSearch(externalQuery);
  }, [externalQuery]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (needle) {
        const haystack = `${order.id} ${order.title} ${order.description} ${order.assignedTo?.name || ''} ${order.department || ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (priority !== 'all' && order.priority !== priority) return false;
      if (memberId !== 'all' && order.assignedTo?.id !== memberId) return false;
      if (onlyOverdue && !isOverdue(order)) return false;
      return true;
    });
  }, [orders, search, priority, memberId, onlyOverdue]);

  const activeFilters = (priority !== 'all' ? 1 : 0) + (memberId !== 'all' ? 1 : 0) + (onlyOverdue ? 1 : 0);

  const clearFilters = () => {
    setPriority('all');
    setMemberId('all');
    setOnlyOverdue(false);
    setSearch('');
    setQueryParam('q', null);
    setQueryParam('priority', null);
    setQueryParam('member', null);
    setQueryParam('overdue', null);
  };

  const onDrop = async (event: React.DragEvent, status: OrderStatus) => {
    event.preventDefault();
    setDragOver(null);
    const id = event.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    if (!id) return;
    const order = orders.find((item) => item.id === id);
    if (!order || order.status === status) return;
    await setStatus(id, status);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Operación</div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--txt)] mt-1">Órdenes de trabajo</h1>
          <p className="text-[12.5px] text-[var(--txt-2)] mt-1">
            {filtered.length} de {orders.length} órdenes · arrastrá una tarjeta para cambiar de estado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented<ViewMode>
            value={view}
            onChange={setView}
            options={[
              { value: 'board', label: 'Tablero', icon: KanbanSquare },
              { value: 'list', label: 'Lista', icon: List },
            ]}
          />
        </div>
      </div>

      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--txt-3)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onBlur={() => setQueryParam('q', search)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setQueryParam('q', search);
              }}
              placeholder="Buscar por título, ID, responsable…"
              className="input h-9 pl-9"
            />
          </div>

          <Button
            variant={showFilters || activeFilters > 0 ? 'outline' : 'subtle'}
            size="sm"
            icon={SlidersHorizontal}
            onClick={() => setShowFilters((prev) => !prev)}
            className="h-9"
          >
            Filtros
            {activeFilters > 0 ? (
              <span className="mono text-[10px] px-1.5 rounded bg-[var(--accent-soft)] text-[var(--accent-2)]">{activeFilters}</span>
            ) : null}
          </Button>

          <button
            type="button"
            onClick={() => {
              setOnlyOverdue((prev) => !prev);
              setQueryParam('overdue', !onlyOverdue ? '1' : null);
            }}
            className={cn(
              'h-9 px-3 rounded-lg border text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors',
              onlyOverdue
                ? 'border-[rgba(255,93,108,0.45)] bg-[var(--danger-soft)] text-[#ff93a0]'
                : 'border-[var(--line)] bg-[var(--panel-2)] text-[var(--txt-2)] hover:text-[var(--txt)]',
            )}
          >
            <AlertTriangle size={13} />
            Vencidas
          </button>

          {activeFilters > 0 || search ? (
            <Button variant="ghost" size="sm" icon={X} onClick={clearFilters}>
              Limpiar
            </Button>
          ) : null}
        </div>

        {showFilters ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-[var(--line)]">
            <label className="field">
              <span className="label">Prioridad</span>
              <Select
                value={priority}
                onChange={(event) => {
                  setPriority(event.target.value);
                  setQueryParam('priority', event.target.value === 'all' ? null : event.target.value);
                }}
                className="h-9"
              >
                <option value="all">Todas</option>
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {PRIORITY_META[value].label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="field">
              <span className="label">Responsable</span>
              <Select
                value={memberId}
                onChange={(event) => {
                  setMemberId(event.target.value);
                  setQueryParam('member', event.target.value === 'all' ? null : event.target.value);
                }}
                className="h-9"
              >
                <option value="all">Todo el equipo</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </label>

            <div className="flex items-end">
              <div className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 h-9 flex items-center gap-2 text-[12px] text-[var(--txt-2)]">
                <Filter size={13} />
                {activeFilters === 0 ? 'Sin filtros activos' : `${activeFilters} filtro(s) aplicados`}
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Board */}
      {view === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            const columnOrders = filtered
              .filter((order) => order.status === status)
              .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

            return (
              <div
                key={status}
                className="kanban-col"
                data-over={dragOver === status}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(status);
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget === event.target) setDragOver(null);
                }}
                onDrop={(event) => {
                  if (canManage) void onDrop(event, status);
                }}
              >
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--line)]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: meta.stripe }} />
                    <span className="text-[12.5px] font-medium text-[var(--txt)]">{meta.label}</span>
                    <span className="mono text-[10px] text-[var(--txt-3)]">{columnOrders.length}</span>
                  </div>
                  {meta.next ? <ArrowRight size={12} className="text-[var(--txt-3)]" /> : null}
                </div>

                <div className="p-2 space-y-2 flex-1">
                  {columnOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      draggable={canManage}
                      onDragStart={
                        canManage
                          ? (event, dragged) => {
                              event.dataTransfer.setData('text/plain', dragged.id);
                              event.dataTransfer.effectAllowed = 'move';
                              setDraggingId(dragged.id);
                            }
                          : undefined
                      }
                      onOpen={(selected) => navigate(`/ordenes/${selected.id}`)}
                      onAdvance={canManage ? (selected, next) => void setStatus(selected.id, next) : undefined}
                    />
                  ))}

                  {columnOrders.length === 0 ? (
                    <div className="py-8 text-center text-[11.5px] text-[var(--txt-3)] border border-dashed border-[var(--line)] rounded-lg">
                      {dragOver === status ? 'Soltá acá para mover' : 'Sin órdenes'}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Filter}
              title={orders.length === 0 ? 'Todavía no hay órdenes' : 'Sin resultados'}
              description={
                orders.length === 0
                  ? 'Creá la primera orden para empezar a operar.'
                  : 'Probá ajustar la búsqueda o los filtros aplicados.'
              }
              action={
                orders.length === 0 ? undefined : (
                  <Button variant="outline" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Estado</th>
                    <th className="hidden sm:table-cell">Prioridad</th>
                    <th className="hidden md:table-cell">Responsable</th>
                    <th>Vencimiento</th>
                    <th className="hidden lg:table-cell">Notas</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => {
                    const due = dueLabel(order);
                    return (
                      <tr key={order.id} onClick={() => navigate(`/ordenes/${order.id}`)}>
                        <td>
                          <div className="flex items-start gap-2 min-w-0 max-w-[420px]">
                            {order.origin === 'telegram' ? <Bot size={13} className="text-[var(--cyan)] mt-0.5 shrink-0" /> : null}
                            <div className="min-w-0">
                              <div className="mono text-[10px] text-[var(--txt-3)]">#{order.id}</div>
                              <div className="text-[13px] text-[var(--txt)] font-medium truncate">{order.title}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="hidden sm:table-cell">
                          <PriorityBadge priority={order.priority} />
                        </td>
                        <td className="hidden md:table-cell">
                          {order.assignedTo ? (
                            <div className="flex items-center gap-2">
                              <Avatar name={order.assignedTo.name} color={order.assignedTo.color} size={22} />
                              <span className="text-[12px] text-[var(--txt-2)] truncate max-w-[130px]">{order.assignedTo.name}</span>
                            </div>
                          ) : (
                            <Badge tone="neutral">Sin asignar</Badge>
                          )}
                        </td>
                        <td>
                          <span
                            className="mono text-[11px] whitespace-nowrap"
                            style={{ color: due.tone === 'red' ? '#ff93a0' : due.tone === 'amber' ? '#ffc971' : 'var(--txt-3)' }}
                          >
                            {due.text}
                          </span>
                        </td>
                        <td className="hidden lg:table-cell mono text-[11px] text-[var(--txt-3)]">{order.notes?.length || 0}</td>
                        <td>
                          <Button variant="ghost" size="sm" iconOnly icon={ArrowRight} onClick={(event) => { event.stopPropagation(); navigate(`/ordenes/${order.id}`); }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
