import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Trash2,
  MessageSquare,
  Eye,
  Filter,
  Users,
  Smartphone,
  Monitor,
  LayoutGrid,
  List,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Calendar,
  X,
  ArrowRight,
  Layers,
} from 'lucide-react';
import {
  Order,
  Member,
  OrderStatus,
  OrderPriority,
  UserSession,
  DeviceViewMode,
} from '../types';
import { hasPermission } from '../lib/rbacConfig';

interface MainOrdersScreenProps {
  orders: Order[];
  members: Member[];
  session: UserSession;
  viewDevice?: DeviceViewMode;
  onOpenNewOrder: () => void;
  onOpenReminder: (order: Order) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus, noteText?: string) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
  onAddNote: (orderId: string, noteText: string) => Promise<void>;
  onRefreshData?: () => Promise<void>;
}

export const MainOrdersScreen: React.FC<MainOrdersScreenProps> = ({
  orders,
  members,
  session,
  viewDevice = 'pc',
  onOpenNewOrder,
  onOpenReminder,
  onUpdateStatus,
  onDeleteOrder,
  onAddNote,
  onRefreshData,
}) => {
  // Estado del cuadro de cantidad seleccionado en el dashboard (por defecto null = lista oculta)
  type QuantityCategory = 'total' | 'pendientes' | 'ejecutadas' | 'urgentes' | null;
  const [selectedCategory, setSelectedCategory] = useState<QuantityCategory>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [viewFormat, setViewFormat] = useState<'table' | 'cards'>(() =>
    viewDevice === 'mobile' ? 'cards' : 'table'
  );

  // Modales locales para notas y detalle completo
  const [selectedOrderForNotes, setSelectedOrderForNotes] = useState<Order | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [orderForFullDetail, setOrderForFullDetail] = useState<Order | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Sincronizar formato de visualización con el modo de pantalla seleccionado
  useEffect(() => {
    if (viewDevice === 'mobile') {
      setViewFormat('cards');
    }
  }, [viewDevice]);

  // Cerrar ventana flotante de órdenes al presionar la tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCategory) {
        setSelectedCategory(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCategory]);

  // CÁLCULO DE MÉTRICAS Y PORCENTAJES GENERALES
  const metrics = useMemo(() => {
    const total = orders.length;
    const finalizadas = orders.filter((o) => o.status === 'finalizada').length;
    const recibidas = orders.filter((o) => o.status === 'recibida').length;
    const enCuenta = orders.filter((o) => o.status === 'en_cuenta').length;
    const enProceso = orders.filter((o) => o.status === 'en_proceso').length;
    const pendientes = total - finalizadas; // recibidas + en_cuenta + en_proceso

    const now = Date.now();
    const vencidas = orders.filter(
      (o) => o.status !== 'finalizada' && new Date(o.dueDate).getTime() < now
    ).length;
    const urgentes = orders.filter(
      (o) =>
        o.status !== 'finalizada' &&
        (o.priority === 'urgente' || new Date(o.dueDate).getTime() < now)
    ).length;

    const porcentajeEjecucion = total > 0 ? Math.round((finalizadas / total) * 100) : 0;
    const porcentajePendientes = total > 0 ? Math.round((pendientes / total) * 100) : 0;
    const porcentajeVencidas = total > 0 ? Math.round((vencidas / total) * 100) : 0;

    return {
      total,
      finalizadas,
      pendientes,
      recibidas,
      enCuenta,
      enProceso,
      urgentes,
      vencidas,
      porcentajeEjecucion,
      porcentajePendientes,
      porcentajeVencidas,
    };
  }, [orders]);

  // FILTRADO DINÁMICO DE ÓRDENES SEGÚN EL CUADRO DE CANTIDADES SELECCIONADO
  const filteredOrders = useMemo(() => {
    if (!selectedCategory) return [];

    return orders.filter((o) => {
      // 1. Filtro según el cuadro seleccionado en el dashboard
      if (selectedCategory === 'pendientes' && o.status === 'finalizada') return false;
      if (selectedCategory === 'ejecutadas' && o.status !== 'finalizada') return false;
      if (selectedCategory === 'urgentes') {
        const isUrgentOrOverdue =
          o.status !== 'finalizada' &&
          (o.priority === 'urgente' || new Date(o.dueDate).getTime() < Date.now());
        if (!isUrgentOrOverdue) return false;
      }

      // 2. Filtro de prioridad
      if (priorityFilter !== 'all' && o.priority !== priorityFilter) return false;

      // 3. Filtro de miembro
      if (memberFilter !== 'all' && o.assignedTo?.id !== memberFilter) return false;

      // 4. Búsqueda de texto
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchTitle = o.title.toLowerCase().includes(query);
        const matchDesc = o.description.toLowerCase().includes(query);
        const matchId = o.id.toLowerCase().includes(query);
        const matchMember = o.assignedTo?.name.toLowerCase().includes(query) || false;
        const matchTg = o.assignedTo?.telegramUser.toLowerCase().includes(query) || false;
        if (!matchTitle && !matchDesc && !matchId && !matchMember && !matchTg) return false;
      }

      return true;
    });
  }, [orders, selectedCategory, priorityFilter, memberFilter, searchTerm]);

  // Actualización rápida de 1 clic: Marcar como Ejecutada (Finalizada)
  const handleQuickExecute = async (order: Order) => {
    setUpdatingOrderId(order.id);
    try {
      await onUpdateStatus(
        order.id,
        'finalizada',
        `Orden marcada como ejecutada por ${session.name}`
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Reabrir orden ejecutada si es necesario
  const handleReopenOrder = async (order: Order) => {
    setUpdatingOrderId(order.id);
    try {
      await onUpdateStatus(
        order.id,
        'en_proceso',
        `Orden reabierta a En Proceso por ${session.name}`
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Guardar nota
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForNotes || !newNoteText.trim()) return;
    setIsSubmittingNote(true);
    try {
      await onAddNote(selectedOrderForNotes.id, newNoteText.trim());
      setNewNoteText('');
      setSelectedOrderForNotes(null);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Prioridad badges
  const getPriorityBadge = (p: OrderPriority) => {
    switch (p) {
      case 'urgente':
        return (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#ef4444]/20 text-[#f87171] border border-[#ef4444]/40 flex items-center gap-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-ping" />
            URGENTE
          </span>
        );
      case 'alta':
        return (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#f59e0b]/20 text-[#fbbf24] border border-[#f59e0b]/40 w-fit">
            ALTA
          </span>
        );
      case 'media':
        return (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#3b82f6]/20 text-[#93c5fd] border border-[#3b82f6]/40 w-fit">
            MEDIA
          </span>
        );
      case 'baja':
        return (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full font-medium bg-[#1e2330] text-[#c2c6d6] border border-[#2b303e] w-fit">
            BAJA
          </span>
        );
    }
  };

  // Estado badges
  const getStatusBadge = (s: OrderStatus) => {
    switch (s) {
      case 'recibida':
        return (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full font-medium bg-[#64748b]/20 text-[#94a3b8] border border-[#64748b]/40">
            📥 Recibida
          </span>
        );
      case 'en_cuenta':
        return (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full font-medium bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/40">
            👀 En Cuenta
          </span>
        );
      case 'en_proceso':
        return (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#f59e0b]/20 text-[#fbbf24] border border-[#f59e0b]/40">
            ⏳ En Proceso
          </span>
        );
      case 'finalizada':
        return (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#10b981]/20 text-[#34d399] border border-[#10b981]/40 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-[#34d399]" />
            ✅ Ejecutada
          </span>
        );
    }
  };

  return (
    <div className="MainOrdersScreen space-y-5 pb-8 font-sans w-full max-w-full transition-all duration-300">
      {/* ============================================================== */}
      {/* 1. SECCIÓN PRINCIPAL: PORCENTAJE GENERAL DE TODAS LAS ÓRDENES   */}
      {/* ============================================================== */}
      <section className="bg-gradient-to-r from-[#111622] via-[#141926] to-[#121724] border border-[#262c3c] rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Glow de fondo */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#005ac2]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-[#10b981]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-6">
          {/* Cabecera del Dashboard y Botón Crear Orden */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#232732]/70">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#4d8eff] bg-[#005ac2]/20 px-2.5 py-1 rounded-lg font-bold border border-[#005ac2]/30">
                MÉTRICAS OPERATIVAS GLOBALES
              </span>
              {onRefreshData && (
                <button
                  type="button"
                  onClick={onRefreshData}
                  className="p-1 rounded-lg text-[#8c909f] hover:text-white hover:bg-[#1f2535] transition cursor-pointer"
                  title="Actualizar datos"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {hasPermission(session.role, 'create_orders') && (
              <button
                type="button"
                onClick={onOpenNewOrder}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#005ac2] to-[#2563eb] hover:from-[#004bb0] hover:to-[#1d4ed8] text-white font-bold text-xs shadow-lg shadow-[#005ac2]/30 ring-1 ring-white/20 transition duration-150 cursor-pointer active:scale-98 shrink-0"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>Crear Nueva Orden</span>
              </button>
            )}
          </div>

          {/* ============================================================== */}
          {/* TRES GRÁFICOS CIRCULARES EN LÍNEA HORIZONTAL SIN LEYENDA       */}
          {/* ============================================================== */}
          <div className="flex flex-row items-center justify-around sm:justify-center sm:gap-14 md:gap-20 py-2 sm:py-4">
            {/* CÍRCULO 1: ÓRDENES EJECUTADAS */}
            <button
              type="button"
              onClick={() => setSelectedCategory('ejecutadas')}
              className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 shrink-0 flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform duration-150"
              title={`Órdenes Ejecutadas: ${metrics.porcentajeEjecucion}%`}
            >
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-[#1a2232]"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-[#10b981] transition-all duration-700 ease-out"
                  strokeWidth="8"
                  strokeDasharray={251.2}
                  strokeDashoffset={251.2 - (251.2 * metrics.porcentajeEjecucion) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-center">
                <span className="font-mono text-lg sm:text-2xl font-extrabold text-[#10b981] tracking-tight leading-none">
                  {metrics.porcentajeEjecucion}%
                </span>
              </div>
            </button>

            {/* CÍRCULO 2: ÓRDENES PENDIENTES */}
            <button
              type="button"
              onClick={() => setSelectedCategory('pendientes')}
              className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 shrink-0 flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform duration-150"
              title={`Órdenes Pendientes: ${metrics.porcentajePendientes}%`}
            >
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-[#1a2232]"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-[#f59e0b] transition-all duration-700 ease-out"
                  strokeWidth="8"
                  strokeDasharray={251.2}
                  strokeDashoffset={251.2 - (251.2 * metrics.porcentajePendientes) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-center">
                <span className="font-mono text-lg sm:text-2xl font-extrabold text-[#fbbf24] tracking-tight leading-none">
                  {metrics.porcentajePendientes}%
                </span>
              </div>
            </button>

            {/* CÍRCULO 3: ÓRDENES VENCIDAS */}
            <button
              type="button"
              onClick={() => setSelectedCategory('urgentes')}
              className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 shrink-0 flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform duration-150"
              title={`Órdenes Vencidas: ${metrics.porcentajeVencidas}%`}
            >
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-[#1a2232]"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-[#ef4444] transition-all duration-700 ease-out"
                  strokeWidth="8"
                  strokeDasharray={251.2}
                  strokeDashoffset={251.2 - (251.2 * metrics.porcentajeVencidas) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-center">
                <span className="font-mono text-lg sm:text-2xl font-extrabold text-[#f87171] tracking-tight leading-none">
                  {metrics.porcentajeVencidas}%
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* CUADROS INTERACTIVOS DONDE APARECEN LAS ÓRDENES POR CANTIDADES */}
        <div className="pt-4 border-t border-[#232732]/70 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#8c909f]">
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
              Indicadores de Órdenes (toca un cuadro para abrir en ventana flotante):
            </span>
            {selectedCategory && (
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="text-[11px] text-[#4d8eff] hover:underline font-mono cursor-pointer flex items-center gap-1"
              >
                <span>✕ Cerrar ventana flotante</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Cuadro 1: Total */}
            <button
              type="button"
              onClick={() => setSelectedCategory(selectedCategory === 'total' ? null : 'total')}
              className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                selectedCategory === 'total'
                  ? 'bg-[#18233a] border-[#005ac2] ring-2 ring-[#005ac2]/50 shadow-lg shadow-[#005ac2]/20'
                  : 'bg-[#0e121a] hover:bg-[#141a27] border-[#232732] hover:border-[#384258]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#8c909f] font-bold">
                  Total Órdenes
                </span>
                <Layers className="w-4 h-4 text-[#60a5fa]" />
              </div>
              <div className="text-2xl font-mono font-extrabold text-white">{metrics.total}</div>
              <div className="text-[10px] text-[#8c909f] mt-1 flex items-center justify-between font-mono">
                <span>{selectedCategory === 'total' ? '▲ Ventana abierta' : '▼ Abrir ventana'}</span>
                {selectedCategory === 'total' && (
                  <span className="text-[#60a5fa] font-bold">• Activo</span>
                )}
              </div>
            </button>

            {/* Cuadro 2: Pendientes */}
            <button
              type="button"
              onClick={() =>
                setSelectedCategory(selectedCategory === 'pendientes' ? null : 'pendientes')
              }
              className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                selectedCategory === 'pendientes'
                  ? 'bg-[#291e10] border-[#f59e0b] ring-2 ring-[#f59e0b]/50 shadow-lg shadow-[#f59e0b]/20'
                  : 'bg-[#0e121a] hover:bg-[#1c1813] border-[#232732] hover:border-[#f59e0b]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#fbbf24] font-bold">
                  Pendientes
                </span>
                <Clock className="w-4 h-4 text-[#fbbf24]" />
              </div>
              <div className="text-2xl font-mono font-extrabold text-[#fbbf24]">{metrics.pendientes}</div>
              <div className="text-[10px] text-[#fbbf24]/80 mt-1 flex items-center justify-between font-mono">
                <span>{selectedCategory === 'pendientes' ? '▲ Ventana abierta' : '▼ Abrir ventana'}</span>
                {selectedCategory === 'pendientes' && (
                  <span className="text-[#fbbf24] font-bold">• Activo</span>
                )}
              </div>
            </button>

            {/* Cuadro 3: Ejecutadas */}
            <button
              type="button"
              onClick={() =>
                setSelectedCategory(selectedCategory === 'ejecutadas' ? null : 'ejecutadas')
              }
              className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                selectedCategory === 'ejecutadas'
                  ? 'bg-[#0f241a] border-[#10b981] ring-2 ring-[#10b981]/50 shadow-lg shadow-[#10b981]/20'
                  : 'bg-[#0e121a] hover:bg-[#121c17] border-[#232732] hover:border-[#10b981]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#34d399] font-bold">
                  Ejecutadas
                </span>
                <CheckCircle2 className="w-4 h-4 text-[#34d399]" />
              </div>
              <div className="text-2xl font-mono font-extrabold text-[#34d399]">{metrics.finalizadas}</div>
              <div className="text-[10px] text-[#34d399]/80 mt-1 flex items-center justify-between font-mono">
                <span>{selectedCategory === 'ejecutadas' ? '▲ Ventana abierta' : '▼ Abrir ventana'}</span>
                {selectedCategory === 'ejecutadas' && (
                  <span className="text-[#34d399] font-bold">• Activo</span>
                )}
              </div>
            </button>

            {/* Cuadro 4: Urgentes */}
            <button
              type="button"
              onClick={() =>
                setSelectedCategory(selectedCategory === 'urgentes' ? null : 'urgentes')
              }
              className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                selectedCategory === 'urgentes'
                  ? 'bg-[#291114] border-[#ef4444] ring-2 ring-[#ef4444]/50 shadow-lg shadow-[#ef4444]/20'
                  : 'bg-[#0e121a] hover:bg-[#1f1315] border-[#232732] hover:border-[#ef4444]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#f87171] font-bold">
                  Urgentes / Vencidas
                </span>
                <AlertTriangle className="w-4 h-4 text-[#f87171]" />
              </div>
              <div className="text-2xl font-mono font-extrabold text-[#f87171]">{metrics.urgentes}</div>
              <div className="text-[10px] text-[#f87171]/80 mt-1 flex items-center justify-between font-mono">
                <span>{selectedCategory === 'urgentes' ? '▲ Ventana abierta' : '▼ Abrir ventana'}</span>
                {selectedCategory === 'urgentes' && (
                  <span className="text-[#f87171] font-bold">• Activo</span>
                )}
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* VENTANA FLOTANTE (MODAL): DETALLE DE ÓRDENES POR INDICADOR      */}
      {/* ============================================================== */}
      {selectedCategory !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCategory(null);
          }}
        >
          <div className="bg-[#121620] border border-[#2b303e] rounded-3xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Cabecera de la Ventana Flotante */}
            <div className="p-4 sm:p-5 border-b border-[#232732] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d1017]">
              <div className="flex items-center gap-2.5">
                {selectedCategory === 'pendientes' && <Clock className="w-5 h-5 text-[#fbbf24]" />}
                {selectedCategory === 'ejecutadas' && <CheckCircle2 className="w-5 h-5 text-[#34d399]" />}
                {selectedCategory === 'urgentes' && <AlertTriangle className="w-5 h-5 text-[#f87171]" />}
                {selectedCategory === 'total' && <Layers className="w-5 h-5 text-[#60a5fa]" />}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-white">
                      {selectedCategory === 'pendientes' && 'Órdenes Pendientes'}
                      {selectedCategory === 'ejecutadas' && 'Órdenes Ejecutadas'}
                      {selectedCategory === 'urgentes' && 'Órdenes Urgentes / Vencidas'}
                      {selectedCategory === 'total' && 'Todas las Órdenes'}
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e2535] text-[#adc6ff] border border-[#2b303e]">
                      {filteredOrders.length} {filteredOrders.length === 1 ? 'orden' : 'órdenes'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8c909f]">
                    Ventana flotante de detalle operativo • Presiona ESC o el botón para cerrar
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2">
                {/* Switcher Formato (Tabla vs Tarjetas) */}
                <div className="flex items-center bg-[#0a0e16] p-1 rounded-xl border border-[#232732]">
                  <button
                    type="button"
                    onClick={() => setViewFormat('table')}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      viewFormat === 'table'
                        ? 'bg-[#1e2535] text-[#4d8eff]'
                        : 'text-[#717686] hover:text-[#c2c6d6]'
                    }`}
                    title="Vista de Tabla Completa"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewFormat('cards')}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      viewFormat === 'cards'
                        ? 'bg-[#1e2535] text-[#4d8eff]'
                        : 'text-[#717686] hover:text-[#c2c6d6]'
                    }`}
                    title="Vista de Tarjetas Táctiles"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>

                {/* Botón Cerrar Ventana Flotante */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1e2535] hover:bg-[#ef4444]/20 hover:text-[#ef4444] border border-[#2b303e] text-xs font-semibold text-[#dfe2ee] transition cursor-pointer"
                  title="Cerrar ventana (ESC)"
                >
                  <X className="w-4 h-4" />
                  <span>Cerrar Ventana</span>
                </button>
              </div>
            </div>

            {/* Buscador y Filtros */}
            <div className="p-3 sm:p-4 border-b border-[#232732] bg-[#0e121a]">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                {/* Campo de Búsqueda en Vivo */}
                <div className="sm:col-span-6 lg:col-span-7 relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#717686]" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por ID, título, especialista o @telegram..."
                    className="w-full bg-[#121620] border border-[#232732] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-[#717686] focus:outline-none focus:border-[#4d8eff] transition"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#717686] hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filtro por Prioridad */}
                <div className="sm:col-span-3 lg:col-span-3">
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="w-full bg-[#121620] border border-[#232732] rounded-xl px-3 py-2 text-xs text-[#c2c6d6] focus:outline-none focus:border-[#4d8eff] transition cursor-pointer"
                  >
                    <option value="all">Todas las Prioridades</option>
                    <option value="urgente">🚨 Solo Urgentes</option>
                    <option value="alta">⚠️ Prioridad Alta</option>
                    <option value="media">🔹 Prioridad Media</option>
                    <option value="baja">⚪ Prioridad Baja</option>
                  </select>
                </div>

                {/* Filtro por Especialista */}
                <div className="sm:col-span-3 lg:col-span-2">
                  <select
                    value={memberFilter}
                    onChange={(e) => setMemberFilter(e.target.value)}
                    className="w-full bg-[#121620] border border-[#232732] rounded-xl px-3 py-2 text-xs text-[#c2c6d6] focus:outline-none focus:border-[#4d8eff] transition cursor-pointer truncate"
                  >
                    <option value="all">Todos Especialistas</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name.split(' ')[0]} ({m.telegramUser})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Contenido Desplazable de la Ventana Flotante */}
            <div className="p-3 sm:p-5 overflow-y-auto flex-1">
              {filteredOrders.length === 0 ? (
                <div className="bg-[#0e121a] border border-[#232732] rounded-3xl p-10 text-center space-y-3 my-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#1e2535] text-[#8c909f] flex items-center justify-center mx-auto">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">Sistema Limpio: Sin Órdenes</h3>
                  <p className="text-xs text-[#8c909f] max-w-sm mx-auto">
                    {searchTerm || priorityFilter !== 'all' || memberFilter !== 'all'
                      ? 'No hay órdenes que coincidan con los filtros aplicados.'
                      : 'La base de datos está completamente despejada y lista para tu prueba técnica.'}
                  </p>
                  {hasPermission(session.role, 'create_orders') && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory(null);
                          onOpenNewOrder();
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#005ac2] to-[#2563eb] hover:from-[#00489d] hover:to-[#1d4ed8] text-white text-xs font-bold shadow-lg shadow-[#005ac2]/30 transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Crear Primera Orden de Prueba</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : viewFormat === 'table' && viewDevice === 'pc' ? (
                /* VISTA TABLA (Modo PC) */
                <div className="bg-[#0e121a] border border-[#232732] rounded-2xl shadow-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#232732] bg-[#090d14] text-[#8c909f] font-mono text-[10px] uppercase tracking-wider">
                          <th className="py-3 px-4">Orden / ID</th>
                          <th className="py-3 px-4">Título & Detalle</th>
                          <th className="py-3 px-4">Especialista</th>
                          <th className="py-3 px-4">Prioridad</th>
                          <th className="py-3 px-4">Estado Operativo</th>
                          <th className="py-3 px-4">Vencimiento</th>
                          <th className="py-3 px-4 text-right">Acción Rápida</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e2330] text-xs">
                        {filteredOrders.map((order) => {
                          const isFinalizada = order.status === 'finalizada';
                          const isOverdue =
                            !isFinalizada && new Date(order.dueDate).getTime() < Date.now();

                          return (
                            <tr
                              key={order.id}
                              className="hover:bg-[#161b27] transition group"
                            >
                              {/* ID & Origen */}
                              <td className="py-3.5 px-4 font-mono">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      isFinalizada
                                        ? 'bg-[#10b981]'
                                        : isOverdue
                                        ? 'bg-[#ef4444] animate-pulse'
                                        : 'bg-[#f59e0b]'
                                    }`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setOrderForFullDetail(order)}
                                    className="font-bold text-white hover:text-[#4d8eff] cursor-pointer text-left"
                                    title="Click para ver ficha completa"
                                  >
                                    #{order.id}
                                  </button>
                                </div>
                                <span className="text-[9px] text-[#717686] block mt-0.5">
                                  {order.origin === 'telegram' ? '📱 Telegram' : '💻 Web'}
                                </span>
                              </td>

                              {/* Título & Detalle */}
                              <td className="py-3.5 px-4 max-w-xs">
                                <div
                                  onClick={() => setOrderForFullDetail(order)}
                                  className="font-medium text-[#dfe2ee] hover:text-white cursor-pointer truncate"
                                  title={order.title}
                                >
                                  {order.title}
                                </div>
                                <p className="text-[11px] text-[#8c909f] truncate mt-0.5">
                                  {order.description || 'Sin notas descriptivas'}
                                </p>
                              </td>

                              {/* Especialista Asignado */}
                              <td className="py-3.5 px-4">
                                {order.assignedTo ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-[#1e2535] text-[#adc6ff] flex items-center justify-center font-bold text-[10px] border border-[#2b303e]">
                                      {order.assignedTo.name.charAt(0)}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-white font-medium truncate max-w-[120px]">
                                        {order.assignedTo.name}
                                      </span>
                                      <span className="text-[10px] text-[#229ed9] font-mono">
                                        {order.assignedTo.telegramUser}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[#717686] italic text-[11px]">Sin asignar</span>
                                )}
                              </td>

                              {/* Prioridad */}
                              <td className="py-3.5 px-4">{getPriorityBadge(order.priority)}</td>

                              {/* Estado con selector */}
                              <td className="py-3.5 px-4">
                                <select
                                  value={order.status}
                                  onChange={(e) =>
                                    onUpdateStatus(order.id, e.target.value as OrderStatus)
                                  }
                                  disabled={updatingOrderId === order.id}
                                  className="bg-[#121620] border border-[#232732] rounded-lg px-2 py-1 text-[11px] font-mono text-[#c2c6d6] focus:outline-none focus:border-[#4d8eff] cursor-pointer"
                                >
                                  <option value="recibida">📥 Recibida</option>
                                  <option value="en_cuenta">👀 En Cuenta</option>
                                  <option value="en_proceso">⏳ En Proceso</option>
                                  <option value="finalizada">✅ Finalizada (Ejecutada)</option>
                                </select>
                              </td>

                              {/* Vencimiento */}
                              <td className="py-3.5 px-4 font-mono text-[11px]">
                                <span className={isOverdue ? 'text-[#f87171] font-bold' : 'text-[#8c909f]'}>
                                  {new Date(order.dueDate).toLocaleDateString('es-ES', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                {isOverdue && (
                                  <span className="block text-[9px] text-[#ef4444] font-bold">
                                    ⚠️ VENCIDA
                                  </span>
                                )}
                              </td>

                              {/* Acciones Rápidas */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {!isFinalizada ? (
                                    <button
                                      type="button"
                                      onClick={() => handleQuickExecute(order)}
                                      disabled={updatingOrderId === order.id}
                                      className="px-2.5 py-1 rounded-lg bg-[#10b981]/20 hover:bg-[#10b981]/30 text-[#34d399] border border-[#10b981]/40 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                                      title="1 Clic: Marcar como ejecutada ahora"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Ejecutar</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleReopenOrder(order)}
                                      disabled={updatingOrderId === order.id}
                                      className="px-2.5 py-1 rounded-lg bg-[#3b82f6]/20 hover:bg-[#3b82f6]/30 text-[#60a5fa] border border-[#3b82f6]/40 text-xs font-bold transition cursor-pointer"
                                      title="Reabrir a En Proceso"
                                    >
                                      <span>Reabrir</span>
                                    </button>
                                  )}

                                  {/* Notificar por Telegram */}
                                  <button
                                    type="button"
                                    onClick={() => onOpenReminder(order)}
                                    className="p-1.5 rounded-lg bg-[#161c28] hover:bg-[#202738] text-[#229ed9] border border-[#262e40] transition cursor-pointer"
                                    title="Despachar push a Telegram"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Notas */}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedOrderForNotes(order)}
                                    className="p-1.5 rounded-lg bg-[#161c28] hover:bg-[#202738] text-[#fbbf24] border border-[#262e40] transition cursor-pointer relative"
                                    title="Notas y observaciones"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    {order.notes && order.notes.length > 0 && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24] absolute top-1 right-1" />
                                    )}
                                  </button>

                                  {/* Ver Detalle */}
                                  <button
                                    type="button"
                                    onClick={() => setOrderForFullDetail(order)}
                                    className="p-1.5 rounded-lg bg-[#161c28] hover:bg-[#202738] text-[#c2c6d6] hover:text-white border border-[#262e40] transition cursor-pointer"
                                    title="Ver ficha completa"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Eliminar si tiene permisos */}
                                  {hasPermission(session.role, 'manage_orders') && (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteOrder(order.id)}
                                      className="p-1.5 rounded-lg bg-[#161c28] hover:bg-[#ef4444]/20 text-[#ef4444] border border-[#262e40] transition cursor-pointer"
                                      title="Eliminar orden"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* VISTA TARJETAS (Modo Móvil y Touch) */
                <div
                  className={`grid gap-3.5 transition-all duration-300 ${
                    viewDevice === 'mobile'
                      ? 'grid-cols-1 max-w-xl mx-auto'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  }`}
                >
                  {filteredOrders.map((order) => {
                    const isFinalizada = order.status === 'finalizada';
                    const isOverdue =
                      !isFinalizada && new Date(order.dueDate).getTime() < Date.now();

                    return (
                      <div
                        key={order.id}
                        className={`bg-[#0e121a] border rounded-2xl p-4 space-y-3 transition shadow-md relative ${
                          isFinalizada
                            ? 'border-[#10b981]/30 hover:border-[#10b981]/50'
                            : isOverdue
                            ? 'border-[#ef4444]/40 hover:border-[#ef4444]/60 bg-gradient-to-b from-[#1b1419] to-[#0e121a]'
                            : 'border-[#232732] hover:border-[#4d8eff]/40'
                        }`}
                      >
                        {/* Cabecera Tarjeta: ID + Prioridad + Estado */}
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#232732]">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isFinalizada ? 'bg-[#10b981]' : isOverdue ? 'bg-[#ef4444]' : 'bg-[#f59e0b]'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setOrderForFullDetail(order)}
                              className="font-mono text-xs font-bold text-white hover:text-[#4d8eff] cursor-pointer"
                            >
                              #{order.id}
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {getPriorityBadge(order.priority)}
                            {getStatusBadge(order.status)}
                          </div>
                        </div>

                        {/* Título y Descripción */}
                        <div
                          onClick={() => setOrderForFullDetail(order)}
                          className="cursor-pointer space-y-1"
                        >
                          <h4 className="text-sm font-bold text-white leading-snug line-clamp-2">
                            {order.title}
                          </h4>
                          <p className="text-xs text-[#8c909f] line-clamp-2">
                            {order.description || 'Sin notas descriptivas'}
                          </p>
                        </div>

                        {/* Datos de Asignación y Vencimiento */}
                        <div className="bg-[#141924] p-2.5 rounded-xl border border-[#232732] space-y-1.5 font-mono text-xs">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#8c909f]">Especialista:</span>
                            <span className="text-white font-medium truncate max-w-[150px]">
                              {order.assignedTo ? order.assignedTo.name : 'Sin asignar'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#8c909f]">Vencimiento:</span>
                            <span className={isOverdue ? 'text-[#f87171] font-bold' : 'text-[#c2c6d6]'}>
                              {new Date(order.dueDate).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {isOverdue && ' (VENCIDA)'}
                            </span>
                          </div>
                        </div>

                        {/* Botones de Acción de Tarjeta */}
                        <div className="pt-1 flex items-center justify-between gap-2">
                          {!isFinalizada ? (
                            <button
                              type="button"
                              onClick={() => handleQuickExecute(order)}
                              disabled={updatingOrderId === order.id}
                              className="flex-1 py-2 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Ejecutar Ahora</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReopenOrder(order)}
                              disabled={updatingOrderId === order.id}
                              className="flex-1 py-2 rounded-xl bg-[#1e2535] hover:bg-[#283247] text-[#93c5fd] text-xs font-bold transition cursor-pointer"
                            >
                              <span>Reabrir Orden</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onOpenReminder(order)}
                            className="p-2 rounded-xl bg-[#161c28] hover:bg-[#202738] text-[#229ed9] border border-[#262e40] transition cursor-pointer"
                            title="Telegram push"
                          >
                            <Send className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedOrderForNotes(order)}
                            className="p-2 rounded-xl bg-[#161c28] hover:bg-[#202738] text-[#fbbf24] border border-[#262e40] transition cursor-pointer"
                            title="Notas"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setOrderForFullDetail(order)}
                            className="p-2 rounded-xl bg-[#161c28] hover:bg-[#202738] text-white border border-[#262e40] transition cursor-pointer"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MODALES CONTEXTUALES: NOTAS Y DETALLE COMPLETO             */}
      {/* ============================================================== */}
      {/* Modal de Notas / Observaciones */}
      {selectedOrderForNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#141822] border border-[#2b303e] rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#232732]">
              <div>
                <h3 className="font-bold text-white text-sm">
                  Notas de Orden #{selectedOrderForNotes.id}
                </h3>
                <p className="text-[11px] text-[#8c909f]">{selectedOrderForNotes.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForNotes(null)}
                className="p-1 rounded-lg text-[#8c909f] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Historial de Notas */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {selectedOrderForNotes.notes && selectedOrderForNotes.notes.length > 0 ? (
                selectedOrderForNotes.notes.map((n, idx) => (
                  <div
                    key={n.id || idx}
                    className="p-3 rounded-xl bg-[#0d111a] border border-[#232732] text-xs space-y-1"
                  >
                    <div className="flex justify-between font-mono text-[10px] text-[#717686]">
                      <span className="text-[#a5b4fc] font-bold">{n.author}</span>
                      <span>
                        {new Date(n.createdAt).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-white">{n.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#717686] italic text-center py-4">
                  No hay notas registradas para esta orden aún.
                </p>
              )}
            </div>

            {/* Agregar Nueva Nota */}
            <form onSubmit={handleSaveNote} className="space-y-3 pt-2 border-t border-[#232732]">
              <textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Escribe una observación o actualización..."
                className="w-full bg-[#0a0e16] border border-[#2b303e] rounded-xl p-3 text-xs text-white placeholder-[#717686] focus:outline-none focus:border-[#4d8eff] resize-none h-20"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForNotes(null)}
                  className="px-4 py-2 rounded-xl bg-[#1e2535] text-[#c2c6d6] hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNote}
                  className="px-4 py-2 rounded-xl bg-[#005ac2] hover:bg-[#004bb0] text-white text-xs font-bold transition shadow-md"
                >
                  {isSubmittingNote ? 'Guardando...' : 'Guardar Nota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ficha Completa de Orden */}
      {orderForFullDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121620] border border-[#2b303e] rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#232732]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-[#4d8eff]">
                  #{orderForFullDetail.id}
                </span>
                {getStatusBadge(orderForFullDetail.status)}
                {getPriorityBadge(orderForFullDetail.priority)}
              </div>
              <button
                type="button"
                onClick={() => setOrderForFullDetail(null)}
                className="p-1 rounded-lg text-[#8c909f] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <h3 className="text-base font-bold text-white">{orderForFullDetail.title}</h3>
                <p className="text-xs text-[#c2c6d6] mt-1 leading-relaxed">
                  {orderForFullDetail.description || 'Sin notas descriptivas'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#0d111a] p-3 rounded-2xl border border-[#232732] font-mono text-[11px]">
                <div>
                  <span className="text-[#8c909f] block">Especialista:</span>
                  <span className="text-white font-bold">
                    {orderForFullDetail.assignedTo?.name || 'Sin Asignar'}
                  </span>
                  <span className="text-[#229ed9] block text-[10px]">
                    {orderForFullDetail.assignedTo?.telegramUser || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[#8c909f] block">Origen:</span>
                  <span className="text-white font-bold capitalize">
                    {orderForFullDetail.origin}
                  </span>
                  <span className="text-[#717686] block text-[10px]">
                    Creado: {new Date(orderForFullDetail.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-[#8c909f] block">Fecha Límite:</span>
                  <span className="text-white font-bold">
                    {new Date(orderForFullDetail.dueDate).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[#8c909f] block">Recordatorios:</span>
                  <span className="text-[#fbbf24] font-bold">
                    {orderForFullDetail.remindersCount} despachados
                  </span>
                </div>
              </div>

              {/* Botón de Acción de Ejecutar / Finalizar */}
              <div className="pt-2 flex justify-between gap-3">
                {orderForFullDetail.status !== 'finalizada' ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleQuickExecute(orderForFullDetail);
                      setOrderForFullDetail(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Marcar como Ejecutada Ahora</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      handleReopenOrder(orderForFullDetail);
                      setOrderForFullDetail(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <span>Reabrir Orden</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setOrderForFullDetail(null);
                    onOpenReminder(orderForFullDetail);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#161c28] hover:bg-[#202738] text-[#229ed9] border border-[#262e40] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar Alerta Telegram</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
