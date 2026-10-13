import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Search,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Send,
  Trash2,
  MessageSquare,
  Bot,
  LayoutGrid,
  List,
  Smartphone,
  ExternalLink,
  ChevronRight,
  User,
  Calendar,
  Layers,
} from 'lucide-react';
import { Order, Member, OrderStatus, OrderPriority, UserSession, DeviceViewMode } from '../types';

interface OrdersViewProps {
  orders: Order[];
  members: Member[];
  session: UserSession;
  viewDevice?: DeviceViewMode;
  onOpenNewOrder: () => void;
  onOpenReminder: (order: Order) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus, noteText?: string) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
  onAddNote: (orderId: string, noteText: string) => Promise<void>;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  members,
  session,
  viewDevice = 'pc',
  onOpenNewOrder,
  onOpenReminder,
  onUpdateStatus,
  onDeleteOrder,
  onAddNote,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [professionalFilter, setProfessionalFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'kanban'>(() => {
    return viewDevice === 'mobile' ? 'cards' : 'table';
  });
  const [selectedOrderForNotes, setSelectedOrderForNotes] = useState<Order | null>(null);
  const [orderForFullDetail, setOrderForFullDetail] = useState<Order | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Sync default view mode with viewDevice prop
  useEffect(() => {
    if (viewDevice === 'mobile') {
      setViewMode('cards');
    }
  }, [viewDevice]);

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && o.priority !== priorityFilter) return false;
    if (professionalFilter !== 'all' && o.assignedTo?.id !== professionalFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = o.title.toLowerCase().includes(q);
      const matchDesc = o.description.toLowerCase().includes(q);
      const matchId = o.id.toLowerCase().includes(q);
      const matchUser = o.assignedTo?.name.toLowerCase().includes(q) || false;
      const matchTg = o.assignedTo?.telegramUser.toLowerCase().includes(q) || false;
      if (!matchTitle && !matchDesc && !matchId && !matchUser && !matchTg) return false;
    }
    return true;
  });

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForNotes || !newNoteText.trim()) return;
    setSubmittingNote(true);
    await onAddNote(selectedOrderForNotes.id, newNoteText.trim());
    setNewNoteText('');
    setSubmittingNote(false);
    setSelectedOrderForNotes(null);
  };

  const getPriorityBadge = (p: OrderPriority) => {
    switch (p) {
      case 'urgente':
        return 'bg-[#ef4444]/20 text-[#f87171] border-[#ef4444]/40';
      case 'alta':
        return 'bg-[#f59e0b]/20 text-[#fbbf24] border-[#f59e0b]/40';
      case 'media':
        return 'bg-[#adc6ff]/20 text-[#adc6ff] border-[#adc6ff]/40';
      case 'baja':
        return 'bg-[#31353e] text-[#c2c6d6] border-[#424754]';
    }
  };

  const getStatusBadge = (s: OrderStatus) => {
    switch (s) {
      case 'recibida':
        return 'bg-[#64748b]/15 text-[#94a3b8] border-[#64748b]/40';
      case 'en_cuenta':
        return 'bg-[#3b82f6]/15 text-[#60a5fa] border-[#3b82f6]/40';
      case 'en_proceso':
        return 'bg-[#f59e0b]/15 text-[#fbbf24] border-[#f59e0b]/40';
      case 'finalizada':
        return 'bg-[#10b981]/15 text-[#34d399] border-[#10b981]/40';
    }
  };

  const statusNameMap: Record<OrderStatus, string> = {
    recibida: '📥 Recibida',
    en_cuenta: '👀 En Cuenta',
    en_proceso: '⏳ En Proceso',
    finalizada: '✅ Finalizada',
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Header & View Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-3 border-b border-[#31353e]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#adc6ff] bg-[#adc6ff]/10 px-2 py-0.5 rounded font-semibold">
              Módulo de Órdenes
            </span>
            <span className="text-[#8c909f] text-[10px] font-mono">•</span>
            <span className="text-[#8c909f] text-[10px] font-mono uppercase">
              {filteredOrders.length} Registros Activos
            </span>
          </div>
          <h2 className="text-xl font-semibold text-[#dfe2ee] tracking-tight flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#adc6ff]" />
            <span>Tablero Operativo de Órdenes</span>
          </h2>
          <p className="text-[12px] text-[#8c909f]">
            Control de asignaciones, estados (En Cuenta, En Proceso, Finalizada) y recordatorios en Telegram
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-[#181c24] rounded-lg p-1 border border-[#31353e]/40 gap-1">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[#262a33] text-[#adc6ff] shadow-sm'
                  : 'text-[#8c909f] hover:text-[#dfe2ee]'
              }`}
              title="Vista de Tabla (Ideal para PC)"
              type="button"
            >
              <List className="w-4 h-4" />
              <span className="text-[11px] hidden sm:inline">Tabla PC</span>
            </button>

            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-[#262a33] text-[#38bdf8] shadow-sm'
                  : 'text-[#8c909f] hover:text-[#dfe2ee]'
              }`}
              title="Vista de Tarjetas (Ideal para Móvil sin cortes)"
              type="button"
            >
              <Smartphone className="w-4 h-4" />
              <span className="text-[11px] hidden sm:inline">Tarjetas Móvil</span>
            </button>

            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-[#262a33] text-[#adc6ff] shadow-sm'
                  : 'text-[#8c909f] hover:text-[#dfe2ee]'
              }`}
              title="Vista Kanban por Estado"
              type="button"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-[11px] hidden sm:inline">Kanban</span>
            </button>
          </div>

          <button
            onClick={onOpenNewOrder}
            className="flex items-center gap-1.5 h-9 px-3.5 bg-[#4d8eff] text-[#00285d] hover:bg-[#adc6ff] hover:text-[#002e6a] rounded font-mono text-[11px] font-semibold transition-colors shadow-sm cursor-pointer"
            type="button"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">+ Nueva Orden</span>
            <span className="sm:hidden">+ Orden</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#181c24] border border-[#31353e]/40 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#8c909f] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por ID, título o profesional..."
            className="w-full pl-9 pr-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto font-mono text-[11px]">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-[#dfe2ee] focus:outline-none focus:border-[#4d8eff] cursor-pointer"
          >
            <option value="all">Estado: Todos</option>
            <option value="recibida">📥 Recibidas</option>
            <option value="en_cuenta">👀 En Cuenta</option>
            <option value="en_proceso">⏳ En Proceso</option>
            <option value="finalizada">✅ Finalizadas</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-[#dfe2ee] focus:outline-none focus:border-[#4d8eff] cursor-pointer"
          >
            <option value="all">Prioridad: Todas</option>
            <option value="urgente">🔴 Urgente</option>
            <option value="alta">🟠 Alta</option>
            <option value="media">🟡 Media</option>
            <option value="baja">🟢 Baja</option>
          </select>

          {/* Professional Filter */}
          <select
            value={professionalFilter}
            onChange={(e) => setProfessionalFilter(e.target.value)}
            className="px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-[#dfe2ee] focus:outline-none focus:border-[#4d8eff] cursor-pointer"
          >
            <option value="all">Profesional: Todos</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.telegramUser})
              </option>
            ))}
          </select>

          {(statusFilter !== 'all' ||
            priorityFilter !== 'all' ||
            professionalFilter !== 'all' ||
            searchTerm) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setPriorityFilter('all');
                setProfessionalFilter('all');
                setSearchTerm('');
              }}
              className="text-xs text-[#8c909f] hover:text-[#dfe2ee] px-2 py-1 cursor-pointer transition"
              type="button"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* View Content: Table or Cards or Kanban */}
      {viewMode === 'table' ? (
        <div className="bg-[#181c24] border border-[#31353e]/40 rounded-xl shadow-sm overflow-hidden flex flex-col">
          {/* Scroll Cue & Full Data Advice */}
          <div className="px-4 py-2 bg-[#121620] border-b border-[#31353e]/60 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#8c909f]">
            <span className="flex items-center gap-1.5">
              <span>↔</span>
              <span>
                Vista de Tabla PC: Desliza horizontalmente si la pantalla es estrecha para ver todas las columnas
              </span>
            </span>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className="text-[#38bdf8] hover:underline cursor-pointer font-sans text-xs font-semibold"
            >
              Ver en Tarjetas Móviles (sin cortes) →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#dfe2ee] border-collapse min-w-[980px]">
              <thead className="bg-[#0a0e16] text-[#8c909f] uppercase font-mono text-[10px] tracking-wider border-b border-[#31353e]/60">
                <tr>
                  <th className="py-3 px-4">Orden</th>
                  <th className="py-3 px-4">Asignada a</th>
                  <th className="py-3 px-4">Prioridad</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Fecha Límite</th>
                  <th className="py-3 px-4 text-center">Telegram</th>
                  <th className="py-3 px-4 text-center">Cambio Rápido de Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c2028]">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#8c909f]">
                      No se encontraron órdenes que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const isOverdue =
                      order.status !== 'finalizada' && new Date(order.dueDate).getTime() < Date.now();

                    return (
                      <tr key={order.id} className="hover:bg-[#1c2028]/60 transition">
                        {/* ID & Title */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2 mb-1">
                            <button
                              type="button"
                              onClick={() => setOrderForFullDetail(order)}
                              className="font-mono font-bold text-[#adc6ff] hover:underline text-xs cursor-pointer"
                              title="Click para ver ficha completa"
                            >
                              #{order.id}
                            </button>
                            {order.origin === 'telegram' ? (
                              <span
                                className="inline-flex items-center gap-1 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#229ed9]/15 text-[#229ed9] border border-[#229ed9]/30"
                                title="Recibida desde Telegram Bot"
                              >
                                <Bot className="w-3 h-3" />
                                <span>Bot</span>
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#1c2028] text-[#8c909f] border border-[#31353e]/40">
                                Web
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setOrderForFullDetail(order)}
                            className="font-semibold text-[#dfe2ee] hover:text-[#adc6ff] transition text-left cursor-pointer block"
                          >
                            {order.title}
                          </button>
                          <div className="text-[11px] text-[#8c909f] mt-0.5 line-clamp-2 max-w-md">
                            {order.description}
                          </div>
                        </td>

                        {/* Assignee */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {order.assignedTo ? (
                            <div>
                              <div className="font-medium text-[#dfe2ee]">{order.assignedTo.name}</div>
                              <a
                                href={`https://t.me/${order.assignedTo.telegramUser.replace('@', '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-[#38bdf8] hover:underline font-mono inline-flex items-center gap-1"
                              >
                                <span>{order.assignedTo.telegramUser}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-[#8c909f] italic">Sin designar</span>
                          )}
                        </td>

                        {/* Priority */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded uppercase border ${getPriorityBadge(
                              order.priority
                            )}`}
                          >
                            {order.priority}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded border ${getStatusBadge(
                              order.status
                            )}`}
                          >
                            {statusNameMap[order.status]}
                          </span>
                        </td>

                        {/* Deadline */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                          <div className={isOverdue ? 'text-[#f87171] font-bold' : 'text-[#dfe2ee]'}>
                            {new Date(order.dueDate).toLocaleDateString('es-ES')}
                          </div>
                          <div className="text-[10px] text-[#8c909f]">
                            {new Date(order.dueDate).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>

                        {/* Telegram reminders count */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#1c2028] text-[#dfe2ee] border border-[#31353e]/40"
                            title={`Recordatorios enviados: ${order.remindersCount || 0}`}
                          >
                            <Send className="w-3 h-3 text-[#229ed9]" />
                            <span>{order.remindersCount || 0}</span>
                          </span>
                        </td>

                        {/* Quick Status Selection Buttons */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1 bg-[#0a0e16] p-1 rounded-lg border border-[#31353e]/50 font-mono text-[10px]">
                            <button
                              onClick={() => onUpdateStatus(order.id, 'en_cuenta')}
                              disabled={order.status === 'en_cuenta'}
                              className={`px-2 py-1 rounded font-semibold transition cursor-pointer ${
                                order.status === 'en_cuenta'
                                  ? 'bg-[#3b82f6] text-white'
                                  : 'text-[#8c909f] hover:text-[#60a5fa] hover:bg-[#1c2028]'
                              }`}
                              title="Marcar como En Cuenta"
                              type="button"
                            >
                              En Cuenta
                            </button>
                            <button
                              onClick={() => onUpdateStatus(order.id, 'en_proceso')}
                              disabled={order.status === 'en_proceso'}
                              className={`px-2 py-1 rounded font-semibold transition cursor-pointer ${
                                order.status === 'en_proceso'
                                  ? 'bg-[#f59e0b] text-white'
                                  : 'text-[#8c909f] hover:text-[#fbbf24] hover:bg-[#1c2028]'
                              }`}
                              title="Marcar como En Proceso"
                              type="button"
                            >
                              En Proceso
                            </button>
                            <button
                              onClick={() => onUpdateStatus(order.id, 'finalizada')}
                              disabled={order.status === 'finalizada'}
                              className={`px-2 py-1 rounded font-semibold transition cursor-pointer ${
                                order.status === 'finalizada'
                                  ? 'bg-[#10b981] text-white'
                                  : 'text-[#8c909f] hover:text-[#34d399] hover:bg-[#1c2028]'
                              }`}
                              title="Marcar como Finalizada"
                              type="button"
                            >
                              Finalizar
                            </button>
                          </div>
                        </td>

                        {/* Row Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setOrderForFullDetail(order)}
                              className="p-1.5 rounded-lg bg-[#1c2028] hover:bg-[#262a33] text-[#85cfff] border border-[#31353e]/40 transition cursor-pointer"
                              title="Ver Ficha Técnica Completa"
                              type="button"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setSelectedOrderForNotes(order)}
                              className="p-1.5 rounded-lg bg-[#1c2028] hover:bg-[#262a33] text-[#dfe2ee] border border-[#31353e]/40 transition cursor-pointer relative"
                              title="Ver / Añadir Observaciones"
                              type="button"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-[#adc6ff]" />
                              {order.notes && order.notes.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#4d8eff] text-white text-[9px] font-bold flex items-center justify-center font-mono">
                                  {order.notes.length}
                                </span>
                              )}
                            </button>
                            <button
                              onClick={() => onOpenReminder(order)}
                              className="p-1.5 rounded-lg bg-[#1c2028] hover:bg-[#262a33] text-[#229ed9] border border-[#31353e]/40 transition cursor-pointer"
                              title="Enviar Recordatorio Push por Telegram"
                              type="button"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            {session.role === 'admin' && (
                              <button
                                onClick={() => onDeleteOrder(order.id)}
                                className="p-1.5 rounded-lg bg-[#1c2028] hover:bg-[#ef4444]/20 text-[#8c909f] hover:text-[#f87171] border border-[#31353e]/40 transition cursor-pointer"
                                title="Eliminar Orden"
                                type="button"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* 📱 TARJETAS MÓVILES (Card Layout 100% Legible para Móvil o PC) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOrders.length === 0 ? (
            <div className="col-span-full py-12 text-center text-[#8c909f] bg-[#181c24] rounded-xl border border-[#31353e]/40">
              No se encontraron órdenes que coincidan con los filtros seleccionados.
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isOverdue =
                order.status !== 'finalizada' && new Date(order.dueDate).getTime() < Date.now();

              return (
                <div
                  key={order.id}
                  className="bg-[#181c24] border border-[#31353e]/60 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-sm hover:border-[#4d8eff]/40 transition space-y-4"
                >
                  {/* Card Header: ID + Badges */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#2b303e]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[#adc6ff] bg-[#adc6ff]/10 px-2 py-0.5 rounded-md border border-[#adc6ff]/20">
                        #{order.id}
                      </span>
                      {order.origin === 'telegram' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#229ed9]/15 text-[#229ed9] border border-[#229ed9]/30">
                          <Bot className="w-3 h-3" />
                          <span>Telegram</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#1c2028] text-[#8c909f] border border-[#31353e]/40">
                          Web
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full uppercase border ${getPriorityBadge(
                          order.priority
                        )}`}
                      >
                        {order.priority}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded-full border ${getStatusBadge(
                          order.status
                        )}`}
                      >
                        {statusNameMap[order.status]}
                      </span>
                    </div>
                  </div>

                  {/* Order Title & Description (Sin recortes para lectura completa) */}
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-[#dfe2ee] leading-snug">
                      {order.title}
                    </h3>
                    <p className="text-xs text-[#c2c6d6] leading-relaxed bg-[#0e121a] p-3 rounded-xl border border-[#232732]">
                      {order.description}
                    </p>
                  </div>

                  {/* Metadata Row: Assigned Specialist & Deadline */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                    <div className="bg-[#121620] p-2.5 rounded-xl border border-[#2b303e]/60 space-y-1">
                      <span className="text-[10px] text-[#717686] block uppercase tracking-wider">
                        Asignado a:
                      </span>
                      {order.assignedTo ? (
                        <div>
                          <div className="font-bold text-[#dfe2ee] truncate font-sans text-xs">
                            {order.assignedTo.name}
                          </div>
                          <a
                            href={`https://t.me/${order.assignedTo.telegramUser.replace('@', '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-[#38bdf8] hover:underline flex items-center gap-1"
                          >
                            <span>{order.assignedTo.telegramUser}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-[#8c909f] italic">Sin asignar</span>
                      )}
                    </div>

                    <div className="bg-[#121620] p-2.5 rounded-xl border border-[#2b303e]/60 space-y-1">
                      <span className="text-[10px] text-[#717686] block uppercase tracking-wider">
                        Fecha Límite:
                      </span>
                      <div className={`font-bold text-xs ${isOverdue ? 'text-[#f87171]' : 'text-[#dfe2ee]'}`}>
                        {new Date(order.dueDate).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                        })}{' '}
                        {new Date(order.dueDate).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      <span
                        className={`text-[9.5px] block font-semibold ${
                          isOverdue ? 'text-[#f87171]' : 'text-[#34d399]'
                        }`}
                      >
                        {isOverdue ? '🚨 Vencida' : '✓ En Plazo'}
                      </span>
                    </div>
                  </div>

                  {/* Quick Status Buttons (3 Large Touch Buttons) */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-mono text-[#8c909f] block">
                      CAMBIO RÁPIDO DE ESTADO:
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(order.id, 'en_cuenta')}
                        disabled={order.status === 'en_cuenta'}
                        className={`py-2 px-1 rounded-xl font-bold transition flex items-center justify-center text-center cursor-pointer ${
                          order.status === 'en_cuenta'
                            ? 'bg-[#3b82f6] text-white shadow-md'
                            : 'bg-[#121620] text-[#8c909f] hover:bg-[#3b82f6]/20 hover:text-[#60a5fa] border border-[#2b303e]'
                        }`}
                      >
                        En Cuenta
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(order.id, 'en_proceso')}
                        disabled={order.status === 'en_proceso'}
                        className={`py-2 px-1 rounded-xl font-bold transition flex items-center justify-center text-center cursor-pointer ${
                          order.status === 'en_proceso'
                            ? 'bg-[#f59e0b] text-white shadow-md'
                            : 'bg-[#121620] text-[#8c909f] hover:bg-[#f59e0b]/20 hover:text-[#fbbf24] border border-[#2b303e]'
                        }`}
                      >
                        En Proceso
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(order.id, 'finalizada')}
                        disabled={order.status === 'finalizada'}
                        className={`py-2 px-1 rounded-xl font-bold transition flex items-center justify-center text-center cursor-pointer ${
                          order.status === 'finalizada'
                            ? 'bg-[#10b981] text-white shadow-md'
                            : 'bg-[#121620] text-[#8c909f] hover:bg-[#10b981]/20 hover:text-[#34d399] border border-[#2b303e]'
                        }`}
                      >
                        Finalizar
                      </button>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="pt-2 border-t border-[#2b303e] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenReminder(order)}
                      className="flex-1 py-1.5 px-2 bg-[#229ed9]/15 hover:bg-[#229ed9] text-[#229ed9] hover:text-white rounded-xl text-xs font-mono font-medium transition flex items-center justify-center gap-1.5 cursor-pointer border border-[#229ed9]/30"
                      title="Enviar recordatorio Telegram"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Telegram</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedOrderForNotes(order)}
                      className="py-1.5 px-2.5 bg-[#161a24] hover:bg-[#252b3d] text-[#dfe2ee] rounded-xl text-xs font-mono transition flex items-center gap-1.5 cursor-pointer border border-[#2b303e]"
                      title="Observaciones Técnicas"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#adc6ff]" />
                      <span>{order.notes?.length || 0}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOrderForFullDetail(order)}
                      className="py-1.5 px-2.5 bg-[#161a24] hover:bg-[#252b3d] text-[#85cfff] rounded-xl text-xs font-mono transition flex items-center gap-1.5 cursor-pointer border border-[#2b303e]"
                      title="Ver Ficha Completa"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Detalle</span>
                    </button>

                    {session.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => onDeleteOrder(order.id)}
                        className="p-2 bg-[#161a24] hover:bg-[#ef4444]/20 text-[#8c909f] hover:text-[#f87171] rounded-xl transition cursor-pointer border border-[#2b303e]"
                        title="Eliminar Orden"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(['recibida', 'en_cuenta', 'en_proceso', 'finalizada'] as OrderStatus[]).map(
            (statusKey) => {
              const columnOrders = filteredOrders.filter((o) => o.status === statusKey);
              return (
                <div
                  key={statusKey}
                  className="bg-[#181c24] border border-[#31353e]/40 rounded-xl p-4 flex flex-col min-h-[500px]"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#31353e] mb-3">
                    <span className="font-semibold text-xs text-[#dfe2ee] flex items-center gap-1.5">
                      {statusNameMap[statusKey]}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#0a0e16] text-[#dfe2ee] border border-[#31353e]/40">
                      {columnOrders.length}
                    </span>
                  </div>

                  {/* Cards List */}
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {columnOrders.length === 0 ? (
                      <div className="text-center py-10 text-[11px] text-[#8c909f] italic">
                        Sin órdenes en esta columna
                      </div>
                    ) : (
                      columnOrders.map((ord) => {
                        const isOverdue =
                          ord.status !== 'finalizada' &&
                          new Date(ord.dueDate).getTime() < Date.now();

                        return (
                          <div
                            key={ord.id}
                            className="bg-[#0a0e16] p-3.5 rounded-lg border border-[#31353e]/40 hover:border-[#adc6ff]/50 transition flex flex-col gap-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setOrderForFullDetail(ord)}
                                className="font-mono text-xs font-bold text-[#adc6ff] hover:underline cursor-pointer"
                              >
                                #{ord.id}
                              </button>
                              <span
                                className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded uppercase border ${getPriorityBadge(
                                  ord.priority
                                )}`}
                              >
                                {ord.priority}
                              </span>
                            </div>

                            <h4
                              onClick={() => setOrderForFullDetail(ord)}
                              className="text-[13px] font-semibold text-[#dfe2ee] leading-snug cursor-pointer hover:text-[#adc6ff] transition"
                            >
                              {ord.title}
                            </h4>

                            <p className="text-[11px] text-[#8c909f] line-clamp-2">
                              {ord.description}
                            </p>

                            <div className="pt-2 border-t border-[#1c2028] flex items-center justify-between text-[10px] font-mono text-[#8c909f]">
                              <span>
                                {ord.assignedTo ? ord.assignedTo.name : 'Sin asignar'}
                              </span>
                              <span className={isOverdue ? 'text-[#f87171] font-bold' : ''}>
                                ⏰ {new Date(ord.dueDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                              </span>
                            </div>

                            {/* Kanban Quick Action Buttons */}
                            <div className="flex items-center justify-between pt-1 gap-1">
                              <div className="flex items-center gap-1">
                                {statusKey !== 'en_cuenta' && (
                                  <button
                                    onClick={() => onUpdateStatus(ord.id, 'en_cuenta')}
                                    className="px-2 py-1 rounded bg-[#1c2028] hover:bg-[#3b82f6] text-[#60a5fa] hover:text-white text-[9px] font-mono font-semibold transition cursor-pointer"
                                    title="Mover a En Cuenta"
                                    type="button"
                                  >
                                    En Cuenta
                                  </button>
                                )}
                                {statusKey !== 'en_proceso' && (
                                  <button
                                    onClick={() => onUpdateStatus(ord.id, 'en_proceso')}
                                    className="px-2 py-1 rounded bg-[#1c2028] hover:bg-[#f59e0b] text-[#fbbf24] hover:text-white text-[9px] font-mono font-semibold transition cursor-pointer"
                                    title="Mover a En Proceso"
                                    type="button"
                                  >
                                    En Proceso
                                  </button>
                                )}
                                {statusKey !== 'finalizada' && (
                                  <button
                                    onClick={() => onUpdateStatus(ord.id, 'finalizada')}
                                    className="px-2 py-1 rounded bg-[#1c2028] hover:bg-[#10b981] text-[#34d399] hover:text-white text-[9px] font-mono font-semibold transition cursor-pointer"
                                    title="Finalizar"
                                    type="button"
                                  >
                                    Finalizar
                                  </button>
                                )}
                              </div>

                              <button
                                onClick={() => onOpenReminder(ord)}
                                className="p-1 rounded bg-[#1c2028] hover:bg-[#229ed9] text-[#229ed9] hover:text-white transition cursor-pointer"
                                title="Enviar recordatorio Telegram"
                                type="button"
                              >
                                <Send className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      {/* MODAL: Ficha Técnica Completa de la Orden (100% de datos legibles) */}
      {orderForFullDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-[#161a24] border border-[#2e3444] rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#2b303e]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-[#adc6ff] bg-[#adc6ff]/10 px-2.5 py-1 rounded-lg border border-[#adc6ff]/20">
                  #{orderForFullDetail.id}
                </span>
                <span
                  className={`px-2 py-0.5 text-xs font-mono font-bold rounded-full uppercase border ${getPriorityBadge(
                    orderForFullDetail.priority
                  )}`}
                >
                  {orderForFullDetail.priority}
                </span>
                <span
                  className={`px-2 py-0.5 text-xs font-mono font-semibold rounded-full border ${getStatusBadge(
                    orderForFullDetail.status
                  )}`}
                >
                  {statusNameMap[orderForFullDetail.status]}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOrderForFullDetail(null)}
                className="p-1.5 rounded-lg bg-[#1c2028] hover:bg-[#262a33] text-[#8c909f] hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Title & Full Description */}
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-[#dfe2ee]">
                {orderForFullDetail.title}
              </h3>
              <div className="bg-[#0e121a] p-3.5 rounded-xl border border-[#232732] text-xs text-[#c2c6d6] leading-relaxed">
                {orderForFullDetail.description}
              </div>
            </div>

            {/* Complete Technical Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-[#10141d] p-3 rounded-xl border border-[#232732] space-y-1">
                <span className="text-[10px] text-[#717686] uppercase block">Asignado a:</span>
                {orderForFullDetail.assignedTo ? (
                  <div>
                    <span className="font-bold text-[#dfe2ee] text-sm font-sans block">
                      {orderForFullDetail.assignedTo.name}
                    </span>
                    <span className="text-[#8c909f] text-[11px] block">
                      Rol: {orderForFullDetail.assignedTo.role}
                    </span>
                    <a
                      href={`https://t.me/${orderForFullDetail.assignedTo.telegramUser.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#38bdf8] hover:underline text-[11px] flex items-center gap-1 mt-1"
                    >
                      <span>{orderForFullDetail.assignedTo.telegramUser}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  <span className="text-[#8c909f] italic">Sin profesional asignado</span>
                )}
              </div>

              <div className="bg-[#10141d] p-3 rounded-xl border border-[#232732] space-y-1">
                <span className="text-[10px] text-[#717686] uppercase block">Fechas & Tiempos:</span>
                <div className="space-y-0.5 text-[11px]">
                  <div>
                    <span className="text-[#8c909f]">Creación: </span>
                    <span className="text-[#dfe2ee]">
                      {new Date(orderForFullDetail.createdAt).toLocaleString('es-ES')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8c909f]">Límite SLA: </span>
                    <span className="text-[#fbbf24] font-bold">
                      {new Date(orderForFullDetail.dueDate).toLocaleString('es-ES')}
                    </span>
                  </div>
                  {orderForFullDetail.completedAt && (
                    <div>
                      <span className="text-[#8c909f]">Finalizada: </span>
                      <span className="text-[#34d399] font-bold">
                        {new Date(orderForFullDetail.completedAt).toLocaleString('es-ES')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#10141d] p-3 rounded-xl border border-[#232732] space-y-1">
                <span className="text-[10px] text-[#717686] uppercase block">Origen & Registro:</span>
                <div className="text-[11px]">
                  <span className="text-[#8c909f]">Canal: </span>
                  <span className="text-[#dfe2ee] uppercase font-bold">
                    {orderForFullDetail.origin === 'telegram' ? 'Bot de Telegram' : 'Consola Web'}
                  </span>
                </div>
                <div className="text-[11px]">
                  <span className="text-[#8c909f]">Creado por: </span>
                  <span className="text-[#dfe2ee]">{orderForFullDetail.createdBy || 'Sistema'}</span>
                </div>
              </div>

              <div className="bg-[#10141d] p-3 rounded-xl border border-[#232732] space-y-1">
                <span className="text-[10px] text-[#717686] uppercase block">Push Telegram:</span>
                <div className="text-[11px]">
                  <span className="text-[#8c909f]">Recordatorios emitidos: </span>
                  <span className="text-[#229ed9] font-bold">
                    {orderForFullDetail.remindersCount || 0}
                  </span>
                </div>
                {orderForFullDetail.lastReminderAt && (
                  <div className="text-[10px] text-[#717686]">
                    Último: {new Date(orderForFullDetail.lastReminderAt).toLocaleTimeString('es-ES')}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Status Buttons in Modal */}
            <div className="p-3 bg-[#0e121a] rounded-xl border border-[#232732] space-y-2">
              <span className="text-[11px] font-mono text-[#8c909f] block">
                ACTUALIZAR ESTADO DE LA ORDEN:
              </span>
              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={async () => {
                    await onUpdateStatus(orderForFullDetail.id, 'en_cuenta');
                    setOrderForFullDetail((prev) => (prev ? { ...prev, status: 'en_cuenta' } : null));
                  }}
                  disabled={orderForFullDetail.status === 'en_cuenta'}
                  className={`py-2 px-2 rounded-xl font-bold transition flex items-center justify-center cursor-pointer ${
                    orderForFullDetail.status === 'en_cuenta'
                      ? 'bg-[#3b82f6] text-white shadow-md'
                      : 'bg-[#161a24] text-[#8c909f] hover:bg-[#3b82f6]/20 hover:text-[#60a5fa]'
                  }`}
                >
                  👀 En Cuenta
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onUpdateStatus(orderForFullDetail.id, 'en_proceso');
                    setOrderForFullDetail((prev) => (prev ? { ...prev, status: 'en_proceso' } : null));
                  }}
                  disabled={orderForFullDetail.status === 'en_proceso'}
                  className={`py-2 px-2 rounded-xl font-bold transition flex items-center justify-center cursor-pointer ${
                    orderForFullDetail.status === 'en_proceso'
                      ? 'bg-[#f59e0b] text-white shadow-md'
                      : 'bg-[#161a24] text-[#8c909f] hover:bg-[#f59e0b]/20 hover:text-[#fbbf24]'
                  }`}
                >
                  ⏳ En Proceso
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onUpdateStatus(orderForFullDetail.id, 'finalizada');
                    setOrderForFullDetail((prev) => (prev ? { ...prev, status: 'finalizada' } : null));
                  }}
                  disabled={orderForFullDetail.status === 'finalizada'}
                  className={`py-2 px-2 rounded-xl font-bold transition flex items-center justify-center cursor-pointer ${
                    orderForFullDetail.status === 'finalizada'
                      ? 'bg-[#10b981] text-white shadow-md'
                      : 'bg-[#161a24] text-[#8c909f] hover:bg-[#10b981]/20 hover:text-[#34d399]'
                  }`}
                >
                  ✅ Finalizada
                </button>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-[#2b303e] gap-2">
              <button
                type="button"
                onClick={() => {
                  const o = orderForFullDetail;
                  setOrderForFullDetail(null);
                  onOpenReminder(o);
                }}
                className="py-2 px-4 rounded-xl bg-[#229ed9] hover:bg-[#1a85b9] text-white text-xs font-mono font-bold flex items-center gap-2 cursor-pointer shadow-md transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Despachar Alerta Telegram</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const o = orderForFullDetail;
                  setOrderForFullDetail(null);
                  setSelectedOrderForNotes(o);
                }}
                className="py-2 px-4 rounded-xl bg-[#1c2028] hover:bg-[#262a33] text-[#dfe2ee] text-xs font-mono transition flex items-center gap-2 cursor-pointer border border-[#31353e]"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#adc6ff]" />
                <span>Observaciones ({orderForFullDetail.notes?.length || 0})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Observation Notes Modal */}
      {selectedOrderForNotes && (
        <div className="fixed inset-0 bg-[#0a0e16]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181c24] border border-[#31353e] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#31353e]">
              <div>
                <span className="font-mono text-xs text-[#adc6ff] font-bold">
                  #{selectedOrderForNotes.id}
                </span>
                <h3 className="text-sm font-semibold text-[#dfe2ee]">
                  Observaciones Técnicas & Avances
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrderForNotes(null)}
                className="text-[#8c909f] hover:text-[#dfe2ee] text-lg cursor-pointer"
                type="button"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {!selectedOrderForNotes.notes || selectedOrderForNotes.notes.length === 0 ? (
                <p className="text-xs text-[#8c909f] italic py-3 text-center">
                  No se han registrado observaciones aún para esta orden.
                </p>
              ) : (
                selectedOrderForNotes.notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 rounded-lg bg-[#0a0e16] border border-[#31353e]/40 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#8c909f]">
                      <span className="text-[#adc6ff] font-semibold">{note.author}</span>
                      <span>
                        {new Date((note as any).createdAt || (note as any).timestamp || Date.now()).toLocaleDateString('es-ES')}{' '}
                        {new Date((note as any).createdAt || (note as any).timestamp || Date.now()).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-[#dfe2ee] leading-relaxed">{note.text}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSaveNote} className="space-y-3 pt-2">
              <label className="block text-xs font-semibold text-[#dfe2ee]">
                Añadir Nueva Observación Técnica:
              </label>
              <textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Escriba aquí los avances, dependencias o justificaciones técnicas..."
                rows={3}
                required
                className="w-full p-2.5 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForNotes(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#1c2028] hover:bg-[#262a33] text-xs font-mono text-[#dfe2ee] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingNote || !newNoteText.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-[#4d8eff] hover:bg-[#adc6ff] hover:text-[#002e6a] text-[#00285d] text-xs font-mono font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  {submittingNote ? 'Guardando...' : 'Guardar Observación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
