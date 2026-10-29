import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Send, ShieldCheck, UserPlus } from 'lucide-react';
import { useWorkspace } from '../app/workspace';
import { api } from '../lib/api';
import { Button, Field, Input, Modal, Select, Textarea, Toggle } from '../ui/kit';
import { PRIORITIES, PRIORITY_META, formatDateTime } from '../lib/helpers';
import { Order, OrderPriority, UserRole } from '../types';
import { navigate } from '../app/router';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/* -------------------------------------------------------------------------- */
/* Nueva orden                                                                */
/* -------------------------------------------------------------------------- */

export function NewOrderModal({
  open,
  onClose,
  preselectedMemberId,
}: {
  open: boolean;
  onClose: () => void;
  preselectedMemberId?: string;
}) {
  const { members, createOrder, pushToast } = useWorkspace();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<OrderPriority>('media');
  const [assignedToId, setAssignedToId] = useState(preselectedMemberId || '');
  const [dueDate, setDueDate] = useState(() => toLocalInputValue(new Date(Date.now() + 48 * 3600 * 1000)));
  const [department, setDepartment] = useState('General');
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setPriority('media');
    setAssignedToId(preselectedMemberId || '');
    setDueDate(toLocalInputValue(new Date(Date.now() + 48 * 3600 * 1000)));
    setDepartment('General');
    setNotifyTelegram(true);
    setError('');
  }, [open, preselectedMemberId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Título y descripción son obligatorios.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const order = await createOrder({
        title: title.trim(),
        description: description.trim(),
        priority,
        assignedToId: assignedToId || undefined,
        dueDate: new Date(dueDate).toISOString(),
        department: department.trim() || 'General',
        notifyTelegram,
      });
      onClose();
      navigate(`/ordenes/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la orden.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva orden de trabajo"
      subtitle="Se despacha por Telegram al responsable o al grupo configurado."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" icon={Send} onClick={submit} loading={submitting}>
            Crear y despachar
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <div className="form-error">{error}</div> : null}

        <Field label="Título">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ej: Revisión de tablero eléctrico en planta 2"
            autoFocus
            maxLength={120}
          />
        </Field>

        <Field label="Descripción / instrucciones">
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Detallá el alcance, ubicación y criterios de aceptación…"
            rows={4}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Prioridad">
            <Select value={priority} onChange={(event) => setPriority(event.target.value as OrderPriority)}>
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_META[value].label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Responsable">
            <Select value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)}>
              <option value="">Sin asignar (grupo)</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Área / Departamento">
            <Input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="General" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Fecha y hora límite">
            <Input type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
          <div className="flex items-end pb-1">
            <div className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2.5">
              <Toggle
                checked={notifyTelegram}
                onChange={setNotifyTelegram}
                label="Notificar por Telegram"
                hint="Envía la orden con botones inline al responsable."
              />
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Recordatorio                                                               */
/* -------------------------------------------------------------------------- */

export function ReminderModal({
  open,
  onClose,
  order,
  defaultAllPending = false,
}: {
  open: boolean;
  onClose: () => void;
  order?: Order | null;
  defaultAllPending?: boolean;
}) {
  const { members, refresh, pushToast, stats } = useWorkspace();
  const [mode, setMode] = useState<'order' | 'all'>(defaultAllPending ? 'all' : 'order');
  const [memberId, setMemberId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(defaultAllPending ? 'all' : 'order');
    setMemberId(order?.assignedTo?.id || '');
    setMessage('');
  }, [open, defaultAllPending, order]);

  const submit = async () => {
    setSending(true);
    try {
      const result =
        mode === 'all'
          ? await api.telegram.sendReminder({ targetType: 'all_pending', customMessage: message || undefined })
          : await api.telegram.sendReminder({
              orderId: order?.id,
              memberId: memberId || undefined,
              customMessage: message || undefined,
            });
      pushToast(
        result.sentCount > 0
          ? `Se enviaron ${result.sentCount} recordatorio(s) por Telegram.`
          : 'No hay destinatarios con chat de Telegram configurado.',
        result.sentCount > 0 ? 'success' : 'warning',
      );
      await refresh();
      onClose();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'No se pudo enviar el recordatorio.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enviar recordatorio"
      subtitle="Se envía un push por Telegram con los botones de actualización de estado."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" icon={Bell} onClick={submit} loading={sending} disabled={mode === 'order' && !order}>
            Enviar recordatorio
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-3 text-[12.5px] text-[var(--txt-2)]">
          {order ? (
            <>
              <div className="mono text-[10.5px] text-[var(--txt-3)]">ORDEN #{order.id}</div>
              <div className="text-[var(--txt)] font-medium mt-1">{order.title}</div>
              <div className="mt-1">Límite: {formatDateTime(order.dueDate)}</div>
            </>
          ) : (
            <div>No hay una orden seleccionada.</div>
          )}
        </div>

        {defaultAllPending ? (
          <div className="flex gap-2">
            <Button variant={mode === 'all' ? 'primary' : 'outline'} size="sm" onClick={() => setMode('all')}>
              Todas las pendientes ({stats.pending})
            </Button>
            <Button variant={mode === 'order' ? 'primary' : 'outline'} size="sm" onClick={() => setMode('order')}>
              Solo esta orden
            </Button>
          </div>
        ) : null}

        <Field label="Destinatario">
          <Select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
            <option value="">Responsable asignado / grupo</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} · {member.telegramUser}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Mensaje adicional" hint="Opcional. Se adjunta al recordatorio.">
          <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder="Ej: Priorizar antes del cierre de turno…" />
        </Field>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Alta de integrante                                                         */
/* -------------------------------------------------------------------------- */

export function AddMemberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createMember, pushToast } = useWorkspace();
  const [name, setName] = useState('');
  const [telegramUser, setTelegramUser] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [chatId, setChatId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setTelegramUser('');
    setRole('');
    setEmail('');
    setChatId('');
  }, [open]);

  const submit = async () => {
    if (!name.trim() || !telegramUser.trim()) {
      pushToast('Nombre y usuario de Telegram son obligatorios.', 'error');
      return;
    }
    setSaving(true);
    try {
      await createMember({
        name: name.trim(),
        telegramUser: telegramUser.trim(),
        role: role.trim() || 'Especialista',
        email: email.trim() || undefined,
        telegramChatId: chatId.trim() || undefined,
      });
      onClose();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'No se pudo dar de alta al integrante.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sumar integrante"
      subtitle="Quedará disponible para asignación y notificaciones por Telegram."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" icon={UserPlus} onClick={submit} loading={saving}>
            Dar de alta
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nombre y apellido">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre completo" autoFocus />
          </Field>
          <Field label="Usuario de Telegram">
            <Input value={telegramUser} onChange={(event) => setTelegramUser(event.target.value)} placeholder="@usuario" />
          </Field>
        </div>
        <Field label="Rol / especialidad">
          <Input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Ej: Técnico electricista" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Email" hint="Opcional">
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@empresa.com" />
          </Field>
          <Field label="Chat ID" hint="Opcional. Necesario para recordatorios privados.">
            <Input value={chatId} onChange={(event) => setChatId(event.target.value)} placeholder="123456789" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Confirmación                                                               */
/* -------------------------------------------------------------------------- */

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const [working, setWorking] = useState(false);
  const run = async () => {
    setWorking(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setWorking(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} icon={danger ? AlertTriangle : CheckCircle2} onClick={run} loading={working}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-[var(--txt-2)] leading-relaxed">{description}</p>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Autenticación                                                              */
/* -------------------------------------------------------------------------- */

const ROLE_OPTIONS: Array<{ value: UserRole; label: string; hint: string }> = [
  { value: 'admin', label: 'Administrador', hint: 'Gestión completa de órdenes, equipo y reportes.' },
  { value: 'developer', label: 'Desarrollo', hint: 'Acceso técnico, configuración de Telegram y diagnóstico.' },
  { value: 'viewer', label: 'Observador', hint: 'Solo lectura del tablero y las métricas.' },
];

export function AuthScreen() {
  const { verifyPin } = useWorkspace();
  const [role, setRole] = useState<UserRole>('admin');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const needPin = true; // Todos los roles requieren PIN: la API ya no expone datos sin sesión.

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setWorking(true);
    try {
      await verifyPin(needPin ? pin : '', role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="app-bg min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-3 justify-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4d8dff] to-[#1f4fb8] flex items-center justify-center">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <div className="text-[13px] font-semibold tracking-[0.16em] text-[var(--txt)]">NÚCLEO CONTROL</div>
            <div className="text-[10px] mono uppercase tracking-[0.16em] text-[var(--txt-3)]">Acceso al centro de operaciones</div>
          </div>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          <div className="space-y-2">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRole(option.value)}
                className="w-full text-left rounded-lg border px-3 py-2.5 transition-colors"
                style={{
                  borderColor: role === option.value ? 'rgba(77,141,255,0.55)' : 'var(--line)',
                  background: role === option.value ? 'var(--accent-soft)' : 'var(--panel-2)',
                }}
              >
                <div className="text-[13px] font-medium text-[var(--txt)]">{option.label}</div>
                <div className="text-[11px] text-[var(--txt-2)] mt-0.5">{option.hint}</div>
              </button>
            ))}
          </div>

          {needPin ? (
            <Field label="PIN de acceso">
              <Input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                placeholder="••••••"
                autoFocus
              />
            </Field>
          ) : null}

          {error ? <div className="form-error">{error}</div> : null}

          <Button type="submit" variant="primary" size="lg" loading={working} className="w-full">
            Ingresar
          </Button>
          <p className="hint text-center">Sesión protegida por PIN. El acceso de operadores se realiza por Telegram.</p>
        </form>
      </div>
    </div>
  );
}
