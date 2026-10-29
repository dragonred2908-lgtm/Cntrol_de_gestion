import React, { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  Bot,
  CheckCircle2,
  Globe,
  KeyRound,
  Link2Off,
  Megaphone,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Zap,
} from 'lucide-react';
import { useWorkspace } from '../app/workspace';
import { api } from '../lib/api';
import { Badge, Button, Card, Field, Input, SectionHeader, Textarea, Toggle } from '../ui/kit';
import { ActivityFeed } from '../features/order-ui';
import { formatDateTime } from '../lib/helpers';

export function TelegramPage() {
  const { telegramConfig, saveTelegramConfig, refresh, pushToast, activity, stats, session, orders } = useWorkspace();

  const canManage = session.role === 'admin' || session.role === 'developer';
  const [botToken, setBotToken] = useState('');
  const [groupChatId, setGroupChatId] = useState(telegramConfig.groupChatId || '');
  const [autoReminders, setAutoReminders] = useState(telegramConfig.autoRemindersEnabled ?? true);
  const [hoursBefore, setHoursBefore] = useState(String(telegramConfig.autoReminderHoursBeforeDue ?? 12));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(telegramConfig.webhookUrl || `${window.location.origin}/api/telegram/webhook`);
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);

  useEffect(() => {
    setGroupChatId(telegramConfig.groupChatId || '');
    setAutoReminders(telegramConfig.autoRemindersEnabled ?? true);
    setHoursBefore(String(telegramConfig.autoReminderHoursBeforeDue ?? 12));
    setWebhookUrl(telegramConfig.webhookUrl || `${window.location.origin}/api/telegram/webhook`);
  }, [telegramConfig]);

  const telegramActivity = useMemo(
    () => activity.filter((item) => item.type === 'telegram_sync' || item.type === 'reminder_sent').slice(0, 12),
    [activity],
  );

  const connected = telegramConfig.status === 'connected';

  const save = async () => {
    setSaving(true);
    try {
      await saveTelegramConfig({
        ...(botToken.trim() ? { botToken: botToken.trim() } : {}),
        groupChatId: groupChatId.trim(),
        autoRemindersEnabled: autoReminders,
        autoReminderHoursBeforeDue: Number(hoursBefore) || 12,
      });
      setBotToken('');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'No se pudo guardar la configuración.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const result = await api.telegram.test({
        ...(botToken.trim() ? { botToken: botToken.trim() } : {}),
        ...(groupChatId.trim() ? { groupChatId: groupChatId.trim() } : {}),
      });
      pushToast(result.message || 'Conexión verificada con Telegram.', result.ok ? 'success' : 'error');
      await refresh();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Falló la prueba de conexión.', 'error');
    } finally {
      setTesting(false);
    }
  };

  const setWebhook = async () => {
    setSettingWebhook(true);
    try {
      const result = await api.telegram.setWebhook(webhookUrl.trim());
      pushToast(result.ok ? 'Webhook registrado en Telegram.' : result.description || 'Telegram rechazó el webhook.', result.ok ? 'success' : 'error');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'No se pudo registrar el webhook.', 'error');
    } finally {
      setSettingWebhook(false);
    }
  };

  const clearWebhook = async () => {
    setSettingWebhook(true);
    try {
      const result = await api.telegram.setWebhook('');
      pushToast(
        result.ok
          ? 'Webhook eliminado: el bot vuelve a usar polling.'
          : result.description || 'Telegram rechazó la operación.',
        result.ok ? 'success' : 'error',
      );
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'No se pudo quitar el webhook.', 'error');
    } finally {
      setSettingWebhook(false);
    }
  };

  const remindAll = async () => {
    setSendingReminders(true);
    try {
      const result = await api.telegram.sendReminder({ targetType: 'all_pending' });
      pushToast(
        result.sentCount > 0 ? `Recordatorios enviados: ${result.sentCount}.` : 'No hay destinatarios configurados.',
        result.sentCount > 0 ? 'success' : 'warning',
      );
      await refresh();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'No se pudieron enviar los recordatorios.', 'error');
    } finally {
      setSendingReminders(false);
    }
  };

  const broadcast = async () => {
    if (!broadcastMessage.trim()) {
      pushToast('Escribí el mensaje del comunicado.', 'error');
      return;
    }
    setBroadcasting(true);
    try {
      const result = await api.telegram.broadcast({
        title: broadcastTitle.trim() || undefined,
        message: broadcastMessage.trim(),
        priority: urgent ? 'urgente' : 'normal',
      });
      pushToast(
        result.response?.success === false ? result.response?.error || 'Telegram rechazó el mensaje.' : 'Comunicado emitido al grupo.',
        result.response?.success === false ? 'error' : 'success',
      );
      setBroadcastTitle('');
      setBroadcastMessage('');
      await refresh();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'No se pudo emitir el comunicado.', 'error');
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Canal de despacho</div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--txt)] mt-1">Telegram & notificaciones</h1>
          <p className="text-[12.5px] text-[var(--txt-2)] mt-1">
            Bot, grupo y recordatorios. Los operadores trabajan desde el chat con botones inline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={connected ? 'green' : telegramConfig.status === 'error' ? 'red' : 'amber'} dot>
            {connected ? 'Conectado' : telegramConfig.status === 'error' ? 'Error de conexión' : 'Sin token'}
          </Badge>
          <Button variant="outline" icon={RefreshCw} onClick={() => void refresh()} loading={false}>
            Refrescar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="space-y-4">
          {/* Estado */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--cyan-soft)] border border-[rgba(56,189,248,0.3)] flex items-center justify-center text-[var(--cyan)]">
                <Bot size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-[var(--txt)]">
                  {telegramConfig.botFirstName || 'Bot de Control de Gestión'}
                </div>
                <div className="mono text-[11px] text-[var(--cyan)]">
                  {telegramConfig.botUsername || 'sin autenticar'}
                </div>
              </div>
              <div className="text-right">
                <div className="eyebrow">Última verificación</div>
                <div className="mono text-[11px] text-[var(--txt-2)] mt-1">
                  {telegramConfig.lastSync ? formatDateTime(telegramConfig.lastSync) : 'nunca'}
                </div>
              </div>
            </div>

            {telegramConfig.errorMessage ? (
              <div className="form-error mt-3">{telegramConfig.errorMessage}</div>
            ) : null}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              {[
                { label: 'Grupo', value: telegramConfig.groupChatId || '—' },
                { label: 'Pendientes', value: String(stats.pending) },
                { label: 'Recordatorios', value: String(orders.reduce((sum, order) => sum + (order.remindersCount || 0), 0)) },
                { label: 'Modo', value: telegramConfig.status === 'simulated' ? 'Simulado' : 'Live' },
              ].map((item) => (
                <div key={item.label} className="panel-inset px-2.5 py-2">
                  <div className="text-[9.5px] uppercase tracking-wide text-[var(--txt-3)]">{item.label}</div>
                  <div className="mono text-[11.5px] text-[var(--txt)] mt-1 truncate">{item.value}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Configuración */}
          <Card className="p-4">
            <SectionHeader eyebrow="Credenciales" title="Configuración del bot" subtitle="El token se guarda en el servidor y nunca se muestra completo." />
            <div className="space-y-3.5 mt-4">
              <Field label="Token del bot (BotFather)" hint={telegramConfig.hasToken ? 'Ya hay un token configurado. Dejalo vacío para conservarlo.' : 'Formato 123456789:AA…'}>
                <Input
                  type="password"
                  value={botToken}
                  onChange={(event) => setBotToken(event.target.value)}
                  placeholder={telegramConfig.hasToken ? telegramConfig.tokenMasked || '••••••••' : 'Pegá el token de BotFather'}
                  disabled={!canManage}
                  autoComplete="off"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Chat ID del grupo" hint="Ej: -1002692322280">
                  <Input value={groupChatId} onChange={(event) => setGroupChatId(event.target.value)} disabled={!canManage} placeholder="-100…" />
                </Field>
                <Field label="Recordar con antelación (horas)">
                  <Input type="number" min={1} max={168} value={hoursBefore} onChange={(event) => setHoursBefore(event.target.value)} disabled={!canManage} />
                </Field>
              </div>

              <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-3">
                <Toggle
                  checked={autoReminders}
                  onChange={setAutoReminders}
                  label="Recordatorios automáticos"
                  hint="Envía avisos antes del vencimiento de cada orden pendiente."
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="primary" icon={ShieldCheck} onClick={save} loading={saving} disabled={!canManage}>
                  Guardar configuración
                </Button>
                <Button variant="outline" icon={Zap} onClick={testConnection} loading={testing} disabled={!canManage}>
                  Probar conexión
                </Button>
              </div>
            </div>
          </Card>

          {/* Webhook */}
          <Card className="p-4">
            <SectionHeader eyebrow="Integración" title="Webhook de Telegram" subtitle="Necesario si querés recibir actualizaciones en tiempo real sin polling." />
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <Input value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} disabled={!canManage} className="flex-1" />
              <Button variant="outline" icon={Globe} onClick={setWebhook} loading={settingWebhook} disabled={!canManage}>
                Registrar webhook
              </Button>
              <Button variant="subtle" icon={Link2Off} onClick={clearWebhook} loading={settingWebhook} disabled={!canManage}>
                Quitar webhook
              </Button>
            </div>
            <p className="hint mt-2">
              En desarrollo local Telegram no puede alcanzar tu equipo. El servidor usa polling en segundo plano como respaldo.
              Si el log muestra «Conflict: can't use getUpdates», quitá el webhook para que el polling funcione.
            </p>
          </Card>

          {/* Comunicado */}
          <Card className="p-4">
            <SectionHeader eyebrow="Difusión" title="Comunicado al grupo" />
            <div className="space-y-3 mt-3">
              <Input value={broadcastTitle} onChange={(event) => setBroadcastTitle(event.target.value)} placeholder="Asunto (opcional)" disabled={!canManage} />
              <Textarea value={broadcastMessage} onChange={(event) => setBroadcastMessage(event.target.value)} rows={3} placeholder="Mensaje para todo el grupo…" disabled={!canManage} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setUrgent((prev) => !prev)}
                  className="inline-flex items-center gap-2 text-[12px] text-[var(--txt-2)]"
                  disabled={!canManage}
                >
                  <span className="switch" data-on={urgent} aria-hidden />
                  Marcar como urgente
                </button>
                <Button variant="primary" icon={Megaphone} onClick={broadcast} loading={broadcasting} disabled={!canManage}>
                  Emitir comunicado
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Columna derecha */}
        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader eyebrow="Acción rápida" title="Recordatorio masivo" />
            <p className="text-[12px] text-[var(--txt-2)] mt-2 leading-relaxed">
              Envía un aviso a todos los responsables de órdenes pendientes ({stats.pending}) por Telegram.
            </p>
            <Button variant="primary" icon={BellRing} className="w-full mt-3" onClick={remindAll} loading={sendingReminders} disabled={!canManage || stats.pending === 0}>
              Recordar a todos los pendientes
            </Button>
          </Card>

          <Card className="p-4">
            <SectionHeader eyebrow="Flujo" title="Cómo trabaja el bot" />
            <ol className="mt-3 space-y-3">
              {[
                { icon: Send, title: 'Despacho', text: 'Cada orden nueva se envía al responsable o al grupo con botones inline.' },
                { icon: Smartphone, title: 'Operación', text: 'El operador toca "En cuenta" u "Orden finalizada" desde el chat.' },
                { icon: Radio, title: 'Espejo', text: 'El cambio aparece al instante en esta consola y en los demás dispositivos.' },
                { icon: CheckCircle2, title: 'Auditoría', text: 'Cada acción queda registrada con autor, fecha y detalle.' },
              ].map((step, index) => {
                const Icon = step.icon;
                return (
                  <li key={step.title} className="flex gap-3">
                    <div className="w-6 h-6 rounded-md bg-[var(--panel-2)] border border-[var(--line)] flex items-center justify-center shrink-0 mono text-[10px] text-[var(--txt-3)]">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--txt)]">
                        <Icon size={12} className="text-[var(--txt-3)]" />
                        {step.title}
                      </div>
                      <p className="text-[11.5px] text-[var(--txt-2)] leading-relaxed mt-0.5">{step.text}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card className="p-4">
            <SectionHeader eyebrow="Registro" title="Eventos de Telegram" />
            <div className="mt-3">
              {telegramActivity.length > 0 ? (
                <ActivityFeed items={telegramActivity} />
              ) : (
                <p className="text-[12px] text-[var(--txt-3)] py-2">Sin eventos de Telegram registrados todavía.</p>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-[12px] text-[var(--txt-2)]">
              <KeyRound size={13} className="text-[var(--txt-3)]" />
              <span className="flex-1">Roles con acceso a esta configuración</span>
            </div>
            <p className="hint mt-2">Administrador y Desarrollo. Los operadores solo interactúan por el chat de Telegram.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
