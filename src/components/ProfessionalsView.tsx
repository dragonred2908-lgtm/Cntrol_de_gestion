import React, { useState } from 'react';
import { Users, Plus, Send } from 'lucide-react';
import { Member, Order, UserSession } from '../types';

interface ProfessionalsViewProps {
  members: Member[];
  orders: Order[];
  session: UserSession;
  onAddMember: (memberData: Partial<Member>) => Promise<void>;
  onOpenReminder: (order?: Order, member?: Member) => void;
  onFilterOrdersByMember: (memberId: string) => void;
}

export const ProfessionalsView: React.FC<ProfessionalsViewProps> = ({
  members,
  orders,
  session,
  onAddMember,
  onOpenReminder,
  onFilterOrdersByMember,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [telegramUser, setTelegramUser] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !telegramUser) return;
    setLoading(true);
    await onAddMember({
      name,
      telegramUser,
      telegramChatId: telegramChatId ? Number(telegramChatId) : undefined,
      role: role || 'Desarrollador',
      email: email || `${telegramUser.replace('@', '')}@empresa.com`,
    });
    setName('');
    setTelegramUser('');
    setTelegramChatId('');
    setRole('');
    setEmail('');
    setLoading(false);
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-[#31353e]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#adc6ff] bg-[#adc6ff]/10 px-2 py-0.5 rounded font-semibold">
              Equipo Técnico
            </span>
            <span className="text-[#8c909f] text-[10px] font-mono">•</span>
            <span className="text-[#8c909f] text-[10px] font-mono uppercase">
              {members.length} Especialistas Registrados
            </span>
          </div>
          <h2 className="text-xl font-semibold text-[#dfe2ee] tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-[#adc6ff]" />
            <span>Directorio de Profesionales & Equipo de Desarrollo</span>
          </h2>
          <p className="text-[12px] text-[#8c909f]">
            Integrantes vinculados con cuentas de Telegram para recepción de órdenes y recordatorios
          </p>
        </div>

        {session.role === 'admin' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 h-9 px-3.5 bg-[#4d8eff] text-[#00285d] hover:bg-[#adc6ff] hover:text-[#002e6a] rounded font-mono text-[11px] font-semibold transition-colors shadow-sm cursor-pointer self-start sm:self-auto"
            type="button"
          >
            <Plus className="w-4 h-4" />
            <span>+ Registrar Profesional</span>
          </button>
        )}
      </div>

      {/* Grid of Professionals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => {
          const memberOrders = orders.filter((o) => o.assignedTo?.id === member.id);
          const activeOrders = memberOrders.filter((o) => o.status !== 'finalizada');
          const completedOrders = memberOrders.filter((o) => o.status === 'finalizada');
          const enCuentaCount = memberOrders.filter((o) => o.status === 'en_cuenta').length;
          const enProcesoCount = memberOrders.filter((o) => o.status === 'en_proceso').length;

          const rate =
            memberOrders.length > 0
              ? Math.round((completedOrders.length / memberOrders.length) * 100)
              : 0;

          return (
            <div
              key={member.id}
              className="bg-[#181c24] border border-[#31353e]/40 rounded-xl p-5 shadow-sm flex flex-col justify-between hover:border-[#adc6ff]/50 transition"
            >
              <div>
                {/* Top Member Card Info */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center font-mono text-sm font-bold shadow-sm text-white"
                      style={{ backgroundColor: member.color || '#4d8eff' }}
                    >
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#dfe2ee] text-sm leading-tight">
                        {member.name}
                      </h3>
                      <p className="text-xs text-[#8c909f] font-mono">{member.role}</p>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#4edea3]/15 text-[#4edea3] border border-[#4edea3]/30">
                    Activo
                  </span>
                </div>

                {/* Telegram info */}
                <div className="bg-[#0a0e16] rounded-lg p-2.5 border border-[#31353e]/40 space-y-1 text-xs mb-4">
                  <div className="flex items-center justify-between text-[#dfe2ee]">
                    <span className="text-[#8c909f] text-[11px] font-mono">Usuario Telegram:</span>
                    <a
                      href={`https://t.me/${member.telegramUser.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[#adc6ff] hover:underline font-semibold"
                    >
                      {member.telegramUser}
                    </a>
                  </div>
                  <div className="flex items-center justify-between text-[#dfe2ee]">
                    <span className="text-[#8c909f] text-[11px] font-mono">Correo:</span>
                    <span className="text-[#c2c6d6] text-[11px] truncate font-mono">{member.email}</span>
                  </div>
                </div>

                {/* Operational metrics */}
                <div className="grid grid-cols-3 gap-2 text-center mb-4 font-mono">
                  <div className="bg-[#0a0e16] p-2 rounded-lg border border-[#31353e]/40">
                    <div className="text-[10px] text-[#8c909f]">En Cuenta</div>
                    <div className="text-base font-bold text-[#60a5fa]">{enCuentaCount}</div>
                  </div>
                  <div className="bg-[#0a0e16] p-2 rounded-lg border border-[#31353e]/40">
                    <div className="text-[10px] text-[#8c909f]">En Proceso</div>
                    <div className="text-base font-bold text-[#fbbf24]">{enProcesoCount}</div>
                  </div>
                  <div className="bg-[#0a0e16] p-2 rounded-lg border border-[#31353e]/40">
                    <div className="text-[10px] text-[#8c909f]">Finalizadas</div>
                    <div className="text-base font-bold text-[#34d399]">
                      {completedOrders.length}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1 mb-4 font-mono">
                  <div className="flex justify-between text-[11px] text-[#8c909f]">
                    <span>Efectividad de Entrega</span>
                    <span className="font-bold text-[#34d399]">{rate}%</span>
                  </div>
                  <div className="w-full bg-[#31353e] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#10b981] h-1.5 rounded-full transition-all"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-[#31353e]/50 flex items-center justify-between gap-2 font-mono text-[11px]">
                <button
                  onClick={() => onFilterOrdersByMember(member.id)}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-[#1c2028] hover:bg-[#262a33] text-[#dfe2ee] font-medium border border-[#31353e]/40 transition cursor-pointer"
                  type="button"
                >
                  Ver {activeOrders.length} Órdenes
                </button>

                <button
                  onClick={() => onOpenReminder(undefined, member)}
                  className="py-1.5 px-3 rounded-lg bg-[#229ed9]/15 hover:bg-[#229ed9] text-[#229ed9] hover:text-white font-medium border border-[#229ed9]/30 transition flex items-center gap-1.5 cursor-pointer"
                  title="Enviar recordatorio directo por Telegram"
                  type="button"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Recordar</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal to Register New Member */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0e16]/80 backdrop-blur-sm p-4">
          <div className="bg-[#181c24] border border-[#31353e] rounded-xl w-full max-w-md p-6 shadow-2xl relative text-[#dfe2ee]">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-[#8c909f] hover:text-[#dfe2ee] p-1 text-lg cursor-pointer"
              type="button"
            >
              &times;
            </button>

            <h3 className="text-base font-semibold text-[#dfe2ee] mb-1">Registrar Nuevo Profesional</h3>
            <p className="text-xs text-[#8c909f] mb-4">
              Vincular integrante con Telegram para asignación de órdenes
            </p>

            <form onSubmit={handleCreate} className="space-y-3 font-sans">
              <div>
                <label className="block text-xs font-medium text-[#dfe2ee] mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Andrés Morales"
                  className="w-full px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#dfe2ee] mb-1">
                  Usuario de Telegram (@usuario) *
                </label>
                <input
                  type="text"
                  value={telegramUser}
                  onChange={(e) => setTelegramUser(e.target.value)}
                  placeholder="@andres_dev"
                  className="w-full px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#dfe2ee] mb-1">
                  Rol o Especialidad
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Ej: Desarrollador Backend, QA, Diseñador..."
                  className="w-full px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#dfe2ee] mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="andres@empresa.com"
                  className="w-full px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#1c2028] text-[#dfe2ee] hover:bg-[#262a33] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3.5 py-1.5 rounded-lg bg-[#4d8eff] hover:bg-[#adc6ff] hover:text-[#002e6a] text-[#00285d] font-semibold cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : 'Registrar Profesional'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
