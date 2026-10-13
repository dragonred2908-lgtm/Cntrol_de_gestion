import React, { useState } from 'react';
import {
  Bot,
  Radio,
  Send,
  BellRing,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  Activity,
  Heart,
} from 'lucide-react';
import { TelegramConfig, UserSession } from '../types';

interface TelegramViewProps {
  config: TelegramConfig;
  session: UserSession;
  onUpdateConfig: (newConfig: Partial<TelegramConfig>) => Promise<void>;
  onTriggerPendingReminders: () => Promise<void>;
  onNavigateToSimulator: () => void;
}

export const TelegramView: React.FC<TelegramViewProps> = ({
  config,
  onUpdateConfig,
  onTriggerPendingReminders,
  onNavigateToSimulator,
}) => {
  const [botToken, setBotToken] = useState(config.botToken || '');
  const [groupChatId, setGroupChatId] = useState(config.groupChatId || '');
  const [autoRemindersEnabled, setAutoRemindersEnabled] = useState(config.autoRemindersEnabled);
  const [hoursBefore, setHoursBefore] = useState(config.autoReminderHoursBeforeDue || 12);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [triggeringSweep, setTriggeringSweep] = useState(false);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('Aviso Operativo de Gestión');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState<'normal' | 'urgente'>('normal');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  // Group Connection Test State (Heartbeat)
  const [testingConnection, setTestingConnection] = useState(false);
  const [testReport, setTestReport] = useState<{
    ok: boolean;
    message?: string;
    error?: string;
    hint?: string;
    botUsername?: string;
    botFirstName?: string;
    groupDelivered?: boolean;
    latencyMs?: number;
  } | null>(null);

  const webhookUrl = `${window.location.origin}/api/telegram/webhook`;

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestReport(null);
    try {
      const res = await fetch('/api/telegram/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botToken.trim() || undefined,
          groupChatId: groupChatId.trim() || undefined,
        }),
      });
      const data = await res.json();
      setTestReport(data);

      if (data.ok && data.botUsername) {
        onUpdateConfig({
          botToken: botToken.trim() || config.botToken,
          groupChatId: groupChatId.trim() || config.groupChatId,
          status: 'connected',
          botUsername: data.botUsername,
          botFirstName: data.botFirstName,
        }).catch(() => {});
      }
    } catch (e: any) {
      setTestReport({ ok: false, error: e.message || 'Error de red al intentar conectar con el servidor' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);

    try {
      await onUpdateConfig({
        botToken: botToken.trim(),
        groupChatId: groupChatId.trim(),
        autoRemindersEnabled,
        autoReminderHoursBeforeDue: Number(hoursBefore),
      });
      setStatusMsg({
        type: 'success',
        text: 'Configuración guardada y conexión verificada con Telegram Bot API.',
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Error al conectar con Telegram.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleRunSweep = async () => {
    setTriggeringSweep(true);
    try {
      await onTriggerPendingReminders();
      setStatusMsg({
        type: 'success',
        text: '¡Barrido de recordatorios automáticos ejecutado con éxito en Telegram!',
      });
    } catch (e: any) {
      setStatusMsg({
        type: 'error',
        text: e.message || 'Error al ejecutar recordatorios.',
      });
    } finally {
      setTriggeringSweep(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastBody.trim()) return;
    setSendingBroadcast(true);
    setBroadcastResult(null);

    try {
      const res = await fetch('/api/telegram/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: broadcastTitle,
          message: broadcastBody,
          priority: broadcastPriority,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al emitir');

      setBroadcastResult('Notificación push emitida exitosamente al grupo de Telegram.');
      setBroadcastBody('');
    } catch (err: any) {
      setBroadcastResult(`Error: ${err.message}`);
    } finally {
      setSendingBroadcast(false);
    }
  };

  const isConnected = config.status === 'connected';

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-[#31353e]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#229ed9] bg-[#229ed9]/15 px-2 py-0.5 rounded font-semibold">
              Integración Oficial
            </span>
            <span className="text-[#8c909f] text-[10px] font-mono">•</span>
            <span className="text-[#8c909f] text-[10px] font-mono uppercase">
              Bot & Grupo de Notificaciones
            </span>
          </div>
          <h2 className="text-xl font-semibold text-[#dfe2ee] tracking-tight flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#229ed9]" />
            <span>Configuración Telegram & Notificaciones Push</span>
          </h2>
          <p className="text-[12px] text-[#8c909f]">
            Conexión oficial con Telegram Bot API, enlace de grupo, webhooks y recordatorios automáticos
          </p>
        </div>

        <button
          onClick={onNavigateToSimulator}
          className="flex items-center gap-2 h-9 px-3.5 bg-[#181c24] hover:bg-[#262a33] text-[#adc6ff] border border-[#31353e]/60 rounded font-mono text-[11px] font-medium transition cursor-pointer self-start sm:self-auto"
          type="button"
        >
          <Radio className="w-3.5 h-3.5 text-[#229ed9]" />
          <span>Probar en Simulador en Vivo</span>
        </button>
      </div>

      {/* Connection Status Banner */}
      <div
        className={`rounded-xl p-5 border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          isConnected
            ? 'bg-[#181c24] border-[#10b981]/40 text-[#dfe2ee]'
            : 'bg-[#181c24] border-[#31353e]/50 text-[#dfe2ee]'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isConnected
                ? 'bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30'
                : 'bg-[#1c2028] text-[#8c909f] border border-[#31353e]/40'
            }`}
          >
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-[#dfe2ee] text-base">
                {isConnected
                  ? `Bot Activo: ${config.botUsername || '@bot'}`
                  : 'Modo Simulado / Token Pendiente'}
              </h3>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                  isConnected
                    ? 'bg-[#10b981]/20 text-[#34d399] border border-[#10b981]/30'
                    : 'bg-[#f59e0b]/20 text-[#fbbf24] border border-[#f59e0b]/30'
                }`}
              >
                {isConnected ? 'En Línea' : 'Listo para Configurar'}
              </span>
            </div>
            <p className="text-xs text-[#8c909f] mt-0.5">
              {isConnected
                ? `Conectado al grupo: ${config.groupChatId || 'Predeterminado'} con botones interactivos [En Cuenta, En Proceso, Finalizada].`
                : 'Puedes ingresar tu Token de @BotFather abajo para conectar el bot real, o usar el simulador interactivo integrado.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto font-mono text-[11px]">
          <a
            href="https://t.me/nucleo_control_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-[#1c2028] hover:bg-[#262a33] text-[#229ed9] border border-[#31353e]/50 transition flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Abrir en Telegram</span>
          </a>

          {/* Test Connection (Heartbeat) Button */}
          <button
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="px-3.5 py-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white font-semibold transition flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
            type="button"
            title="Enviar mensaje Heartbeat de verificación al grupo configurado inmediatamente"
          >
            <Activity className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : 'animate-pulse text-[#d1fae5]'}`} />
            <span>{testingConnection ? 'Enviando Heartbeat...' : 'Test Connection'}</span>
          </button>

          <button
            onClick={handleRunSweep}
            disabled={triggeringSweep}
            className="px-3 py-1.5 rounded-lg bg-[#229ed9] hover:bg-[#1c8ec4] text-white font-semibold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            type="button"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${triggeringSweep ? 'animate-spin' : ''}`} />
            <span>{triggeringSweep ? 'Enviando...' : 'Forzar Recordatorios'}</span>
          </button>
        </div>
      </div>

      {/* Test Report Notification (Heartbeat Results) */}
      {testReport && (
        <div
          className={`rounded-xl p-4 border text-xs shadow-md transition space-y-2 font-mono ${
            testReport.groupDelivered
              ? 'bg-[#121b18] border-[#10b981]/60 text-[#dfe2ee]'
              : 'bg-[#1a1712] border-[#f59e0b]/60 text-[#dfe2ee]'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {testReport.groupDelivered ? (
                <CheckCircle2 className="w-5 h-5 text-[#34d399] flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-[#fbbf24] flex-shrink-0 mt-0.5" />
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-[#dfe2ee]">
                    {testReport.groupDelivered
                      ? '¡Heartbeat Entregado con Éxito al Grupo de Telegram!'
                      : testReport.botValid
                      ? 'Bot Autenticado • Heartbeat Pendiente de Entrega en Grupo'
                      : 'Fallo de Verificación en Telegram Bot API'}
                  </span>
                  {typeof testReport.latencyMs === 'number' && (
                    <span className="px-2 py-0.5 rounded-full bg-[#10b981]/20 text-[#34d399] font-mono text-[10px] border border-[#10b981]/30">
                      ⚡ Latencia: {testReport.latencyMs} ms
                    </span>
                  )}
                  {testReport.botUsername && (
                    <span className="px-2 py-0.5 rounded-full bg-[#229ed9]/20 text-[#38bdf8] font-mono text-[10px] border border-[#229ed9]/30">
                      {testReport.botUsername}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 leading-relaxed text-[#c2c6d6] font-sans text-xs">
                  {testReport.groupDelivered
                    ? testReport.message
                    : testReport.hint || testReport.error}
                </p>
                {!testReport.groupDelivered && (
                  <div className="mt-2.5 p-3 rounded-lg bg-[#0a0e16] border border-[#31353e]/50 text-[11px] text-[#c2c6d6] space-y-1 font-sans">
                    <div className="font-bold text-[#fbbf24] flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" />
                      <span>Instrucciones para activar la recepción del Heartbeat en tu grupo:</span>
                    </div>
                    <div>1. Abre la aplicación de Telegram en tu teléfono o PC y entra a tu grupo <b>{groupChatId || '-1002692322280'}</b>.</div>
                    <div>2. Haz clic en el encabezado del grupo &rarr; <b>Añadir Miembro</b> (o Administradores).</div>
                    <div>3. Busca el bot: <code className="text-[#adc6ff] font-mono font-bold">{testReport.botUsername || '@nucleo_control_bot'}</code> y añádelo.</div>
                    <div>4. Vuelve a pulsar <b>"Test Connection"</b> para confirmar la entrega del Heartbeat en tiempo real.</div>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setTestReport(null)}
              className="text-[#8c909f] hover:text-[#dfe2ee] p-1 text-base cursor-pointer"
              type="button"
              title="Cerrar reporte"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Telegram Credentials & Automation Settings */}
        <div className="space-y-6">
          <div className="bg-[#181c24] border border-[#31353e]/40 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-[#dfe2ee] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#adc6ff]" />
              <span>Credenciales y Enlace de Grupo</span>
            </h3>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#dfe2ee] mb-1">
                  Telegram Bot Token (obtenido de @BotFather)
                </label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="Ej: 7123456789:AAHk..."
                  className="w-full px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff] font-mono"
                />
                <p className="text-[11px] text-[#8c909f] mt-1">
                  * Crea tu bot en Telegram buscando a <code className="text-[#adc6ff]">@BotFather</code> y ejecutando <code className="text-[#adc6ff]">/newbot</code>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#dfe2ee] mb-1">
                  ID del Grupo de Telegram o @canal
                </label>
                <input
                  type="text"
                  value={groupChatId}
                  onChange={(e) => setGroupChatId(e.target.value)}
                  placeholder="Ej: -1001928374650 o @grupo_control_gestion"
                  className="w-full px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff] font-mono"
                />
                <p className="text-[11px] text-[#8c909f] mt-1">
                  Añade el bot a tu grupo de Telegram como administrador para enviar recordatorios y órdenes.
                </p>
              </div>

              {/* Automatic reminders toggle */}
              <div className="p-3.5 bg-[#0a0e16] rounded-xl border border-[#31353e]/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#dfe2ee] flex items-center gap-2">
                    <BellRing className="w-3.5 h-3.5 text-[#fbbf24]" />
                    Recordatorios Automáticos de Plazos
                  </span>
                  <input
                    type="checkbox"
                    checked={autoRemindersEnabled}
                    onChange={(e) => setAutoRemindersEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-[#31353e] bg-[#1c2028] text-[#229ed9] focus:ring-[#229ed9] cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-[#8c909f]">
                  El servidor despachará recordatorios con botones interactivos cuando falten pocas horas para la fecha límite de tareas pendientes.
                </p>

                <div className="flex items-center gap-3 pt-1 text-xs">
                  <span className="text-[#8c909f]">Anticipación:</span>
                  <select
                    value={hoursBefore}
                    onChange={(e) => setHoursBefore(Number(e.target.value))}
                    className="px-2.5 py-1 bg-[#181c24] border border-[#31353e]/60 rounded-lg text-xs text-[#dfe2ee] focus:outline-none focus:border-[#4d8eff] cursor-pointer font-mono"
                  >
                    <option value={6}>6 horas antes del límite</option>
                    <option value={12}>12 horas antes del límite</option>
                    <option value={24}>24 horas antes del límite</option>
                    <option value={48}>48 horas antes del límite</option>
                  </select>
                </div>
              </div>

              {statusMsg && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 font-mono ${
                    statusMsg.type === 'success'
                      ? 'bg-[#181c24] border-[#10b981]/50 text-[#34d399]'
                      : 'bg-[#181c24] border-[#ef4444]/50 text-[#f87171]'
                  }`}
                >
                  {statusMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-[#34d399] flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[#ef4444] flex-shrink-0" />
                  )}
                  <span>{statusMsg.text}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="px-3.5 py-2 rounded-lg bg-[#161a24] hover:bg-[#1e2330] text-[#34d399] border border-[#10b981]/40 font-semibold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  title="Enviar Heartbeat de prueba con los datos ingresados"
                >
                  <Activity className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                  <span>{testingConnection ? 'Verificando...' : 'Test Connection'}</span>
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-[#4d8eff] hover:bg-[#adc6ff] hover:text-[#002e6a] text-[#00285d] font-semibold transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{saving ? 'Guardando...' : 'Guardar Configuración'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Webhook Endpoint Info Box */}
          <div className="bg-[#181c24] border border-[#31353e]/40 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-[#dfe2ee] flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#4edea3]" />
              <span>URL de Webhook para Recepción de Órdenes</span>
            </h3>
            <p className="text-xs text-[#8c909f]">
              Registra este endpoint en Telegram para que el bot capture comandos como{' '}
              <code className="text-[#adc6ff]">/nuevaorden</code> y clics en botones inline.
            </p>

            <div className="flex items-center gap-2 bg-[#0a0e16] p-2 rounded-lg border border-[#31353e]/40">
              <code className="text-xs text-[#4edea3] font-mono truncate flex-1">
                {webhookUrl}
              </code>
              <button
                onClick={handleCopyWebhook}
                className="p-1.5 rounded-lg bg-[#1c2028] hover:bg-[#262a33] text-[#dfe2ee] transition cursor-pointer"
                title="Copiar URL"
                type="button"
              >
                {copiedWebhook ? <Check className="w-3.5 h-3.5 text-[#4edea3]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="text-[11px] text-[#8c909f] space-y-1 bg-[#0a0e16] p-3 rounded-lg border border-[#31353e]/40 font-mono">
              <div className="font-semibold text-[#dfe2ee]">Comandos que soporta tu bot:</div>
              <div>• <code>/nuevaorden Tarea | Descripción | urgente | @usuario</code></div>
              <div>• <code>/ordenes</code> - Lista las órdenes activas en el chat</div>
              <div>• Botones inline directos: <code>[En Cuenta]</code>, <code>[En Proceso]</code>, <code>[Finalizada]</code></div>
            </div>
          </div>
        </div>

        {/* Right Column: Push Broadcast Console for Group & Members */}
        <div className="space-y-6">
          <div className="bg-[#181c24] border border-[#31353e]/40 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#dfe2ee] flex items-center gap-2">
                <Send className="w-4 h-4 text-[#229ed9]" />
                <span>Emisión Push en Tiempo Real (Broadcast Masivo)</span>
              </h3>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#229ed9]/15 text-[#229ed9] border border-[#229ed9]/30">
                Grupo & Integrantes
              </span>
            </div>
            <p className="text-xs text-[#8c909f]">
              Envía comunicados generales o recordatorios institucionales a todos los integrantes en Telegram al instante.
            </p>

            <form onSubmit={handleSendBroadcast} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#dfe2ee] mb-1">
                  Título del Comunicado Push
                </label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#dfe2ee] mb-1">
                  Mensaje Detallado para Telegram
                </label>
                <textarea
                  rows={4}
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  placeholder="Escriba el comunicado que llegará a todos los miembros del grupo..."
                  className="w-full px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#dfe2ee] mb-1">
                  Nivel de Alerta
                </label>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => setBroadcastPriority('normal')}
                    className={`py-2 px-3 rounded-lg border transition cursor-pointer ${
                      broadcastPriority === 'normal'
                        ? 'bg-[#229ed9]/20 border-[#229ed9] text-[#229ed9] font-bold'
                        : 'bg-[#0a0e16] border-[#31353e]/40 text-[#8c909f]'
                    }`}
                  >
                    📢 Normal (Aviso)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadcastPriority('urgente')}
                    className={`py-2 px-3 rounded-lg border transition cursor-pointer ${
                      broadcastPriority === 'urgente'
                        ? 'bg-[#ef4444]/20 border-[#ef4444] text-[#f87171] font-bold'
                        : 'bg-[#0a0e16] border-[#31353e]/40 text-[#8c909f]'
                    }`}
                  >
                    🚨 Urgente (Crítico)
                  </button>
                </div>
              </div>

              {broadcastResult && (
                <div className="p-3 rounded-lg bg-[#0a0e16] border border-[#31353e]/50 text-xs font-mono text-[#dfe2ee]">
                  {broadcastResult}
                </div>
              )}

              <div className="flex justify-end pt-1 font-mono text-[11px]">
                <button
                  type="submit"
                  disabled={sendingBroadcast}
                  className="px-4 py-2 rounded-lg bg-[#229ed9] hover:bg-[#1c8ec4] text-white font-semibold transition flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingBroadcast ? 'Transmitiendo...' : 'Emitir Push a Telegram'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Interactive Telegram Simulator shortcut card */}
          <div className="bg-[#181c24] border border-[#31353e]/40 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#229ed9]/15 text-[#229ed9] border border-[#229ed9]/30 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-[#dfe2ee] text-sm">Simulador Interactivo de Telegram</h4>
                <p className="text-xs text-[#8c909f]">
                  Prueba el flujo completo sin salir del navegador
                </p>
              </div>
            </div>
            <p className="text-xs text-[#c2c6d6] leading-relaxed">
              El simulador integrado reproduce la interfaz de Telegram, permitiéndote recibir órdenes, presionar los botones <code className="text-[#60a5fa] font-mono">[En Cuenta]</code>, <code className="text-[#fbbf24] font-mono">[En Proceso]</code> y <code className="text-[#34d399] font-mono">[Finalizada]</code>, y observar cómo se sincroniza la base de datos en tiempo real.
            </p>
            <button
              onClick={onNavigateToSimulator}
              className="w-full py-2 px-3 rounded-lg bg-[#1c2028] hover:bg-[#262a33] text-[#adc6ff] border border-[#31353e]/50 font-mono text-[11px] font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
              type="button"
            >
              <span>Abrir Simulador de Telegram</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
