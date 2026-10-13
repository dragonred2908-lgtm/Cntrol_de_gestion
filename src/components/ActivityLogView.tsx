import React, { useState } from 'react';
import {
  History,
  Search,
  CheckCircle2,
  Clock,
  Send,
  PlusCircle,
  Shield,
  Bot,
} from 'lucide-react';
import { ActivityLog } from '../types';

interface ActivityLogViewProps {
  activities: ActivityLog[];
  onRefresh: () => void;
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({ activities, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filtered = activities.filter((act) => {
    if (typeFilter !== 'all' && act.type !== typeFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchActor = act.actor.toLowerCase().includes(q);
      const matchAction = act.action.toLowerCase().includes(q);
      const matchDetails = act.details.toLowerCase().includes(q);
      const matchOrder = act.orderId?.toLowerCase().includes(q) || false;
      if (!matchActor && !matchAction && !matchDetails && !matchOrder) return false;
    }
    return true;
  });

  const getTypeIcon = (type: ActivityLog['type']) => {
    switch (type) {
      case 'order_created':
        return <PlusCircle className="w-3.5 h-3.5 text-[#adc6ff]" />;
      case 'status_change':
        return <CheckCircle2 className="w-3.5 h-3.5 text-[#4edea3]" />;
      case 'reminder_sent':
        return <Send className="w-3.5 h-3.5 text-[#fbbf24]" />;
      case 'telegram_sync':
        return <Bot className="w-3.5 h-3.5 text-[#229ed9]" />;
      case 'security':
        return <Shield className="w-3.5 h-3.5 text-[#c2c6d6]" />;
      default:
        return <History className="w-3.5 h-3.5 text-[#8c909f]" />;
    }
  };

  const getTypeBadge = (type: ActivityLog['type']) => {
    switch (type) {
      case 'order_created':
        return 'bg-[#adc6ff]/15 text-[#adc6ff] border-[#adc6ff]/30';
      case 'status_change':
        return 'bg-[#4edea3]/15 text-[#4edea3] border-[#4edea3]/30';
      case 'reminder_sent':
        return 'bg-[#fbbf24]/15 text-[#fbbf24] border-[#fbbf24]/30';
      case 'telegram_sync':
        return 'bg-[#229ed9]/15 text-[#229ed9] border-[#229ed9]/30';
      case 'security':
        return 'bg-[#31353e] text-[#c2c6d6] border-[#424754]';
      default:
        return 'bg-[#1c2028] text-[#8c909f] border-[#31353e]';
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-[#31353e]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#adc6ff] bg-[#adc6ff]/10 px-2 py-0.5 rounded font-semibold">
              Registro Inmutable
            </span>
            <span className="text-[#8c909f] text-[10px] font-mono">•</span>
            <span className="text-[#8c909f] text-[10px] font-mono uppercase">
              Trazabilidad Completa
            </span>
          </div>
          <h2 className="text-xl font-semibold text-[#dfe2ee] tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-[#adc6ff]" />
            <span>Historial Completo de Actividad & Auditoría</span>
          </h2>
          <p className="text-[12px] text-[#8c909f]">
            Trazabilidad de cada orden, recordatorio emitido, interacción de Telegram y cambios de estado
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="h-9 px-3.5 rounded-lg bg-[#181c24] hover:bg-[#262a33] text-[#dfe2ee] font-mono text-[11px] font-medium border border-[#31353e]/60 transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          type="button"
        >
          <Clock className="w-3.5 h-3.5 text-[#adc6ff]" />
          <span>Actualizar Historial</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#181c24] border border-[#31353e]/40 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#8c909f] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por usuario, acción, orden..."
            className="w-full pl-9 pr-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto font-mono text-[11px]">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-[#dfe2ee] focus:outline-none focus:border-[#4d8eff] cursor-pointer"
          >
            <option value="all">Tipo: Todos los eventos</option>
            <option value="order_created">Órdenes Creadas</option>
            <option value="status_change">Cambios de Estado</option>
            <option value="reminder_sent">Recordatorios Telegram</option>
            <option value="telegram_sync">Sincronización Webhook</option>
            <option value="security">Seguridad & Sesiones</option>
          </select>
        </div>
      </div>

      {/* Timeline List */}
      <div className="bg-[#181c24] border border-[#31353e]/40 rounded-xl p-6 shadow-sm">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-[#8c909f] text-xs">
            No se registraron actividades que coincidan con la búsqueda.
          </div>
        ) : (
          <div className="relative border-l border-[#31353e]/60 ml-4 space-y-6">
            {filtered.map((act) => (
              <div key={act.id} className="relative pl-6 group">
                {/* Node icon */}
                <div className="absolute -left-3 top-0.5 w-6 h-6 rounded-full bg-[#0a0e16] border border-[#31353e] flex items-center justify-center">
                  {getTypeIcon(act.type)}
                </div>

                <div className="bg-[#0a0e16] border border-[#31353e]/40 rounded-xl p-3.5 space-y-1.5 hover:border-[#adc6ff]/50 transition">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#dfe2ee]">{act.action}</span>
                      <span
                        className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded border ${getTypeBadge(
                          act.type
                        )}`}
                      >
                        {act.type.replace('_', ' ').toUpperCase()}
                      </span>
                      {act.orderId && (
                        <span className="text-xs font-mono font-bold text-[#adc6ff]">
                          #{act.orderId}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#8c909f] font-mono">
                      {new Date(act.timestamp).toLocaleString('es-ES')}
                    </span>
                  </div>

                  <p className="text-xs text-[#c2c6d6] leading-relaxed">{act.details}</p>

                  <div className="pt-1 text-[11px] text-[#8c909f] flex items-center gap-2 font-mono">
                    <span>Ejecutado por:</span>
                    <strong className="text-[#dfe2ee] font-medium">{act.actor}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
