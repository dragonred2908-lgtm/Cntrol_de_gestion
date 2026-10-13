import React, { useState } from 'react';
import { Send, X, Bell, Users, User, CheckCircle, AlertCircle } from 'lucide-react';
import { Member, Order } from '../types';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  orders: Order[];
  preselectedOrder?: Order | null;
  onReminderSent: () => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  members,
  orders,
  preselectedOrder,
  onReminderSent,
}) => {
  const [reminderType, setReminderType] = useState<'individual' | 'all_pending' | 'broadcast'>(
    preselectedOrder ? 'individual' : 'individual'
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string>(preselectedOrder?.id || '');
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    preselectedOrder?.assignedTo?.id || ''
  );
  const [customMessage, setCustomMessage] = useState(
    'Estimado integrante, favor actualizar el avance de esta orden prioritaria o confirmar si se encuentra finalizada.'
  );
  const [broadcastTitle, setBroadcastTitle] = useState('Revisión General de Avance Operativo');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const activeOrders = orders.filter((o) => o.status !== 'finalizada');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      if (reminderType === 'broadcast') {
        const res = await fetch('/api/telegram/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: broadcastTitle,
            message: customMessage,
            priority: 'normal',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al emitir comunicado');
        setResult({
          success: true,
          message: 'Notificación push emitida exitosamente al grupo de Telegram.',
        });
      } else {
        const res = await fetch('/api/telegram/send-reminder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: reminderType === 'individual' ? selectedOrderId : undefined,
            targetType: reminderType === 'all_pending' ? 'all_pending' : 'individual',
            customMessage,
            memberId: selectedMemberId || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al enviar recordatorio');

        setResult({
          success: true,
          message:
            reminderType === 'all_pending'
              ? `Se enviaron recordatorios automáticos para ${data.sentCount} órdenes pendientes.`
              : 'Recordatorio personalizado enviado a Telegram con botones interactivos de actualización.',
        });
      }

      onReminderSent();
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Error al comunicarse con Telegram.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0e16]/80 backdrop-blur-sm p-4 overflow-y-auto font-sans">
      <div className="bg-[#181c24] border border-[#31353e] rounded-xl w-full max-w-xl p-6 shadow-2xl relative text-[#dfe2ee] my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8c909f] hover:text-[#dfe2ee] p-1 rounded-lg hover:bg-[#1c2028] transition cursor-pointer"
          type="button"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-[#229ed9]/15 text-[#229ed9] border border-[#229ed9]/30 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#dfe2ee]">
              Emisión de Recordatorios Push por Telegram
            </h2>
            <p className="text-xs text-[#8c909f]">
              Notificaciones en tiempo real grupales o personalizadas por miembro
            </p>
          </div>
        </div>

        {/* Type selection */}
        <div className="grid grid-cols-3 gap-2 mb-4 font-mono text-[11px]">
          <button
            type="button"
            onClick={() => setReminderType('individual')}
            className={`p-2.5 rounded-lg border text-center font-medium transition cursor-pointer ${
              reminderType === 'individual'
                ? 'bg-[#229ed9]/20 border-[#229ed9] text-[#dfe2ee]'
                : 'bg-[#0a0e16] border-[#31353e]/50 text-[#8c909f] hover:bg-[#1c2028]'
            }`}
          >
            <User className="w-4 h-4 mx-auto mb-1 text-[#229ed9]" />
            <span>Por Miembro / Orden</span>
          </button>

          <button
            type="button"
            onClick={() => setReminderType('all_pending')}
            className={`p-2.5 rounded-lg border text-center font-medium transition cursor-pointer ${
              reminderType === 'all_pending'
                ? 'bg-[#fbbf24]/20 border-[#fbbf24] text-[#dfe2ee]'
                : 'bg-[#0a0e16] border-[#31353e]/50 text-[#8c909f] hover:bg-[#1c2028]'
            }`}
          >
            <Bell className="w-4 h-4 mx-auto mb-1 text-[#fbbf24]" />
            <span>Pendientes Masivo</span>
          </button>

          <button
            type="button"
            onClick={() => setReminderType('broadcast')}
            className={`p-2.5 rounded-lg border text-center font-medium transition cursor-pointer ${
              reminderType === 'broadcast'
                ? 'bg-[#adc6ff]/20 border-[#adc6ff] text-[#dfe2ee]'
                : 'bg-[#0a0e16] border-[#31353e]/50 text-[#8c909f] hover:bg-[#1c2028]'
            }`}
          >
            <Users className="w-4 h-4 mx-auto mb-1 text-[#adc6ff]" />
            <span>Aviso General Grupo</span>
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          {reminderType === 'individual' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#dfe2ee] mb-1 font-mono">
                  SELECCIONAR ORDEN A RECORDAR *
                </label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => {
                    setSelectedOrderId(e.target.value);
                    const sel = orders.find((o) => o.id === e.target.value);
                    if (sel?.assignedTo) setSelectedMemberId(sel.assignedTo.id);
                  }}
                  className="w-full px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] focus:outline-none focus:border-[#4d8eff] cursor-pointer"
                  required
                >
                  <option value="">-- Elija una orden activa --</option>
                  {activeOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      #{o.id} - {o.title} [{o.status.toUpperCase()}] ({o.assignedTo ? o.assignedTo.name : 'Sin asignar'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#dfe2ee] mb-1 font-mono">
                  DESTINATARIO (INTEGRANTE DEL GRUPO)
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] focus:outline-none focus:border-[#4d8eff] cursor-pointer"
                >
                  <option value="">-- Grupo General / Asignado en la orden --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.telegramUser}) - {m.role}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {reminderType === 'broadcast' && (
            <div>
              <label className="block text-xs font-medium text-[#dfe2ee] mb-1 font-mono">
                TÍTULO DEL COMUNICADO GENERAL
              </label>
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff]"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#dfe2ee] mb-1 font-mono">
              MENSAJE PERSONALIZADO DEL ADMINISTRADOR
            </label>
            <textarea
              rows={3}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Indique especificaciones, plazos urgentes o recordatorios puntuales..."
              className="w-full px-3.5 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff]"
              required
            />
          </div>

          {/* Interactive buttons preview */}
          {reminderType !== 'broadcast' && (
            <div className="bg-[#0a0e16] p-3 rounded-lg border border-[#31353e]/50 font-mono">
              <p className="text-[10px] font-semibold text-[#8c909f] uppercase tracking-wider mb-2">
                Botones interactivos que recibirá el usuario en Telegram:
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="py-1.5 px-2 rounded-lg bg-[#181c24] border border-[#60a5fa]/40 text-[#60a5fa] text-xs text-center font-medium">
                  📥 En Cuenta
                </div>
                <div className="py-1.5 px-2 rounded-lg bg-[#181c24] border border-[#fbbf24]/40 text-[#fbbf24] text-xs text-center font-medium">
                  ⏳ En Proceso
                </div>
                <div className="py-1.5 px-2 rounded-lg bg-[#181c24] border border-[#34d399]/40 text-[#34d399] text-xs text-center font-medium">
                  ✅ Finalizada
                </div>
              </div>
            </div>
          )}

          {result && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2 font-mono ${
                result.success
                  ? 'bg-[#181c24] border-[#10b981]/50 text-[#34d399]'
                  : 'bg-[#181c24] border-[#ef4444]/50 text-[#f87171]'
              }`}
            >
              {result.success ? (
                <CheckCircle className="w-4 h-4 text-[#34d399] flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-[#ef4444] flex-shrink-0" />
              )}
              <span>{result.message}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 font-mono text-[11px]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#1c2028] hover:bg-[#262a33] text-[#dfe2ee] font-medium border border-[#31353e]/50 transition cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={loading || (reminderType === 'individual' && !selectedOrderId)}
              className="px-5 py-2 rounded-lg bg-[#229ed9] hover:bg-[#1c8ec4] text-white font-semibold transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Enviando a Telegram...' : 'Enviar Recordatorio Push'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
