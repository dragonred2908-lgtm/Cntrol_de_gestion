import React, { useState } from 'react';
import { PlusCircle, X } from 'lucide-react';
import { Member, OrderPriority } from '../types';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onOrderCreated: () => void;
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  members,
  onOrderCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<OrderPriority>('media');
  const [assignedToId, setAssignedToId] = useState('');
  const [department, setDepartment] = useState('Desarrollo');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 16);
  });
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Por favor complete el título y la descripción.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          priority,
          assignedToId: assignedToId || undefined,
          department,
          dueDate: new Date(dueDate).toISOString(),
          notifyTelegram,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al crear la orden');
      }

      onOrderCreated();
      onClose();
      // Reset
      setTitle('');
      setDescription('');
      setAssignedToId('');
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor.');
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
          <div className="w-10 h-10 rounded-lg bg-[#4d8eff]/15 text-[#adc6ff] border border-[#4d8eff]/30 flex items-center justify-center">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#dfe2ee]">Designar Nueva Orden de Gestión</h2>
            <p className="text-xs text-[#8c909f]">
              Asignación oficial por el Administrador con enlace a Telegram
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#dfe2ee] mb-1 font-mono">
              TÍTULO DE LA ORDEN *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Migración de base de datos a clúster de alta disponibilidad"
              className="w-full px-3.5 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#dfe2ee] mb-1 font-mono">
              DESCRIPCIÓN DETALLADA E INSTRUCCIONES *
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detallar entregables, alcances técnicos, credenciales o consideraciones..."
              className="w-full px-3.5 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#dfe2ee] mb-1 font-mono">
                ASIGNAR A PROFESIONAL
              </label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className="w-full px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] focus:outline-none focus:border-[#4d8eff] cursor-pointer"
              >
                <option value="">-- Sin asignar (Por designar) --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.telegramUser}) - {m.role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#dfe2ee] mb-1 font-mono">
                NIVEL DE PRIORIDAD
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as OrderPriority)}
                className="w-full px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] focus:outline-none focus:border-[#4d8eff] cursor-pointer"
              >
                <option value="baja">🟢 Baja (Rutinaria)</option>
                <option value="media">🟡 Media (Estándar)</option>
                <option value="alta">🟠 Alta (Prioritaria)</option>
                <option value="urgente">🔴 Urgente (Crítica)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#dfe2ee] mb-1 font-mono">
                DEPARTAMENTO / ÁREA
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Backend, Frontend, QA, Infra..."
                className="w-full px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#dfe2ee] mb-1 font-mono">
                FECHA Y HORA LÍMITE
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] focus:outline-none focus:border-[#4d8eff] font-mono cursor-pointer"
                required
              />
            </div>
          </div>

          {/* Telegram notification checkbox */}
          <div className="p-3 bg-[#0a0e16] rounded-lg border border-[#31353e]/50 flex items-start gap-3">
            <input
              type="checkbox"
              id="notifyTelegram"
              checked={notifyTelegram}
              onChange={(e) => setNotifyTelegram(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#31353e] bg-[#1c2028] text-[#229ed9] focus:ring-[#229ed9] cursor-pointer"
            />
            <label htmlFor="notifyTelegram" className="text-xs text-[#8c909f] cursor-pointer">
              <span className="font-semibold text-[#dfe2ee] block">
                Notificar en Telegram inmediatamente con botones interactivos
              </span>
              Se enviará al grupo o chat privado con los botones{' '}
              <code className="text-[#60a5fa] font-mono">[📥 En Cuenta]</code>,{' '}
              <code className="text-[#fbbf24] font-mono">[⏳ En Proceso]</code> y{' '}
              <code className="text-[#34d399] font-mono">[✅ Finalizada]</code>.
            </label>
          </div>

          {error && (
            <p className="text-xs text-[#f87171] bg-[#181c24] p-2.5 rounded-lg border border-[#ef4444]/60 font-mono">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 font-mono text-[11px]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#1c2028] hover:bg-[#262a33] text-[#dfe2ee] font-medium border border-[#31353e]/50 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-[#4d8eff] hover:bg-[#adc6ff] hover:text-[#002e6a] text-[#00285d] font-semibold transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{loading ? 'Creando...' : 'Crear y Asignar Orden'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
