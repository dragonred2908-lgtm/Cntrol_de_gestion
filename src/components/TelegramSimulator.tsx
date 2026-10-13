import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  CheckCheck,
  Sparkles,
  Clock,
} from 'lucide-react';
import { Order, Member, OrderStatus } from '../types';

interface TelegramMessage {
  id: string;
  sender: string;
  senderType: 'user' | 'bot' | 'system';
  avatar?: string;
  text: string;
  timestamp: string;
  orderId?: string;
  orderStatus?: OrderStatus;
  buttons?: Array<{ text: string; action: string; orderId: string; status: OrderStatus }>;
}

interface TelegramSimulatorProps {
  orders: Order[];
  members: Member[];
  onOrderUpdatedFromTelegram: () => void;
}

export const TelegramSimulator: React.FC<TelegramSimulatorProps> = ({
  orders,
  members,
  onOrderUpdatedFromTelegram,
}) => {
  const [messages, setMessages] = useState<TelegramMessage[]>(() => {
    return [
      {
        id: 'msg-1',
        sender: 'Bot Control de Gestión',
        senderType: 'bot',
        timestamp: '10:15 AM',
        text: '👋 ¡Bienvenido al Grupo de Control de Gestión Operativo! Este bot recibe órdenes de trabajo, despacha recordatorios automáticos de fechas límite y sincroniza el estado de las tareas en tiempo real.',
      },
      {
        id: 'msg-2',
        sender: 'Carlos Mendoza (@carlos_mendoza_dev)',
        senderType: 'user',
        timestamp: '10:18 AM',
        text: '/ordenes',
      },
      {
        id: 'msg-3',
        sender: 'Bot Control de Gestión',
        senderType: 'bot',
        timestamp: '10:18 AM',
        text: '📋 <b>Órdenes Activas Pendientes:</b>\n• #ORD-1001: Optimización de latencia en API (Urgente)\n• #ORD-1002: Implementar interfaz de exportación (Alta)\n• #ORD-1003: Auditoría de seguridad Kubernetes (Media)',
      },
      {
        id: 'msg-4',
        sender: 'Bot Control de Gestión',
        senderType: 'bot',
        timestamp: '10:20 AM',
        orderId: 'ORD-1001',
        orderStatus: 'en_proceso',
        text: '📋 <b>ORDEN ASIGNADA: #ORD-1001</b>\n<b>Título:</b> Optimización de latencia en API de pasarela de pagos\n<b>Responsable:</b> Carlos Mendoza (@carlos_mendoza_dev)\n<b>Prioridad:</b> 🔴 Urgente\n<b>Fecha Límite:</b> ⏰ Próximas 6 horas\n\n👇 <i>Selecciona el estado de tu avance:</i>',
        buttons: [
          { text: '📥 En Cuenta', action: 'status', orderId: 'ORD-1001', status: 'en_cuenta' },
          { text: '⏳ En Proceso', action: 'status', orderId: 'ORD-1001', status: 'en_proceso' },
          { text: '✅ Finalizada', action: 'status', orderId: 'ORD-1001', status: 'finalizada' },
        ],
      },
    ];
  });

  const [inputVal, setInputVal] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('@carlos_mendoza_dev');
  const [isProcessing, setIsProcessing] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleButtonClick = async (orderId: string, newStatus: OrderStatus) => {
    setIsProcessing(true);

    try {
      const res = await fetch('/api/telegram/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query: {
            id: `cq-${Date.now()}`,
            from: {
              id: 108456123,
              is_bot: false,
              first_name: selectedUser.replace('@', ''),
              username: selectedUser.replace('@', ''),
            },
            data: `status:${orderId}:${newStatus}`,
          },
        }),
      });

      if (res.ok) {
        const timeStr = new Date().toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const statusMap: Record<OrderStatus, string> = {
          recibida: '📥 Recibida',
          en_cuenta: '👀 En Cuenta',
          en_proceso: '⏳ En Proceso',
          finalizada: '✅ Finalizada',
        };

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: selectedUser,
            senderType: 'user',
            timestamp: timeStr,
            text: `He seleccionado: [${statusMap[newStatus]}] para #${orderId}`,
          },
          {
            id: `msg-${Date.now() + 1}`,
            sender: 'Bot Control de Gestión',
            senderType: 'bot',
            timestamp: timeStr,
            text: `✅ <b>¡Estado Actualizado con Éxito!</b>\nLa orden <b>#${orderId}</b> fue cambiada a <b>${statusMap[newStatus]}</b> por <b>${selectedUser}</b>.\nRegistrado en base de datos y auditoría en tiempo real.`,
          },
        ]);

        onOrderUpdatedFromTelegram();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputVal;
    if (!textToSend.trim() || isProcessing) return;

    const timeStr = new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });

    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender: selectedUser,
        senderType: 'user',
        timestamp: timeStr,
        text: textToSend,
      },
    ]);

    if (!customText) setInputVal('');
    setIsProcessing(true);

    try {
      const res = await fetch('/api/telegram/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: Date.now(),
            from: {
              id: 998877,
              is_bot: false,
              first_name: selectedUser.replace('@', ''),
              username: selectedUser.replace('@', ''),
            },
            chat: {
              id: -1002692322280,
              title: 'Grupo de Gestión',
              type: 'supergroup',
            },
            date: Math.floor(Date.now() / 1000),
            text: textToSend,
          },
        }),
      });

      if (res.ok) {
        onOrderUpdatedFromTelegram();

        setTimeout(() => {
          const respTime = new Date().toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          });

          if (textToSend.startsWith('/nuevaorden')) {
            setMessages((prev) => [
              ...prev,
              {
                id: `msg-${Date.now() + 1}`,
                sender: 'Bot Control de Gestión',
                senderType: 'bot',
                timestamp: respTime,
                text: `✅ <b>NUEVA ORDEN REGISTRADA EXITOSAMENTE</b>\nSe ha creado y notificado al responsable en el sistema web.\n\n👇 <i>Acciones rápidas para el asignado:</i>`,
                buttons: [
                  { text: '📥 En Cuenta', action: 'status', orderId: 'ORD-NUEVA', status: 'en_cuenta' },
                  { text: '⏳ En Proceso', action: 'status', orderId: 'ORD-NUEVA', status: 'en_proceso' },
                  { text: '✅ Finalizada', action: 'status', orderId: 'ORD-NUEVA', status: 'finalizada' },
                ],
              },
            ]);
          } else if (textToSend === '/ordenes') {
            setMessages((prev) => [
              ...prev,
              {
                id: `msg-${Date.now() + 1}`,
                sender: 'Bot Control de Gestión',
                senderType: 'bot',
                timestamp: respTime,
                text: `📋 <b>Sincronización de Órdenes:</b>\nTotal registradas en sistema: <b>${orders.length}</b>.\nUsa los botones o el panel administrativo para ver detalles.`,
              },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                id: `msg-${Date.now() + 1}`,
                sender: 'Bot Control de Gestión',
                senderType: 'bot',
                timestamp: respTime,
                text: `🤖 <b>Comando / Mensaje recibido:</b> "${textToSend}"\nComandos admitidos: <code>/nuevaorden Título | Detalle | urgente | @usuario</code> y <code>/ordenes</code>.`,
              },
            ]);
          }
        }, 400);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulateReminder = () => {
    const pending = orders.find((o) => o.status !== 'finalizada') || orders[0];
    if (!pending) return;

    const timeStr = new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });

    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender: 'Bot Control de Gestión',
        senderType: 'bot',
        timestamp: timeStr,
        orderId: pending.id,
        orderStatus: pending.status,
        text: `🔔 <b>RECORDATORIO AUTOMÁTICO DE TAREA PENDIENTE</b>\nEstimado(a) <b>${pending.assignedTo ? pending.assignedTo.name : 'Equipo'}</b> (${pending.assignedTo ? pending.assignedTo.telegramUser : '@todos'}):\n\nLa orden <b>#${pending.id} - ${pending.title}</b> se encuentra en estado <b>${pending.status.toUpperCase()}</b>.\nFecha límite: ⏰ ${new Date(pending.dueDate).toLocaleString('es-ES')}\n\nPor favor actualiza tu avance:`,
        buttons: [
          { text: '📥 En Cuenta', action: 'status', orderId: pending.id, status: 'en_cuenta' },
          { text: '⏳ En Proceso', action: 'status', orderId: pending.id, status: 'en_proceso' },
          { text: '✅ Finalizada', action: 'status', orderId: pending.id, status: 'finalizada' },
        ],
      },
    ]);
  };

  return (
    <div className="space-y-4 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-[#31353e]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#229ed9] bg-[#229ed9]/15 px-2 py-0.5 rounded font-semibold">
              Simulador Interactivo
            </span>
            <span className="text-[#8c909f] text-[10px] font-mono">•</span>
            <span className="text-[#8c909f] text-[10px] font-mono uppercase">
              Pruebas de Bot y Webhooks
            </span>
          </div>
          <h2 className="text-xl font-semibold text-[#dfe2ee] tracking-tight flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#229ed9]" />
            <span>Simulador Interactivo de Telegram Bot</span>
          </h2>
          <p className="text-[12px] text-[#8c909f]">
            Prueba la recepción de órdenes, los recordatorios del grupo y los botones inline [En Cuenta, En Proceso, Finalizada] en tiempo real
          </p>
        </div>

        {/* Action shortcut to simulate auto reminder */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSimulateReminder}
            className="px-3 py-1.5 rounded-lg bg-[#fbbf24]/15 hover:bg-[#fbbf24]/25 text-[#fbbf24] font-mono text-[11px] font-semibold border border-[#fbbf24]/30 transition flex items-center gap-1.5 cursor-pointer"
            type="button"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Simular Alerta de Plazo</span>
          </button>
        </div>
      </div>

      {/* Main Telegram Window Box */}
      <div className="bg-[#0a0e16] border border-[#31353e]/50 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[640px]">
        {/* Telegram Chat Title Bar */}
        <div className="bg-[#181c24] px-4 py-3 border-b border-[#31353e]/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#229ed9] flex items-center justify-center text-white font-bold text-sm shadow">
              TG
            </div>
            <div>
              <div className="font-semibold text-[#dfe2ee] text-xs flex items-center gap-1.5">
                <span>Grupo: Control de Gestión & Desarrollo</span>
                <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block" />
              </div>
              <div className="text-[10px] text-[#8c909f] font-mono">
                {members.length + 2} miembros • Bot de Órdenes Activo
              </div>
            </div>
          </div>

          {/* User selector for simulation */}
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-[#8c909f] hidden sm:inline">Hablar como:</span>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="px-2.5 py-1 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-[#adc6ff] focus:outline-none cursor-pointer"
            >
              <option value="@admin_gestion">@admin_gestion (Admin)</option>
              {members.map((m) => (
                <option key={m.id} value={m.telegramUser}>
                  {m.telegramUser} ({m.name.split(' ')[0]})
                </option>
              ))}
              <option value="@cliente_externo">@cliente_externo</option>
            </select>
          </div>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0e16]">
          {messages.map((msg) => {
            const isBot = msg.senderType === 'bot';

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isBot ? 'justify-start' : 'justify-end'}`}
              >
                {isBot && (
                  <div className="w-8 h-8 rounded-full bg-[#229ed9]/15 text-[#229ed9] border border-[#229ed9]/30 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-lg rounded-xl p-3.5 shadow-md space-y-2 ${
                    isBot
                      ? 'bg-[#181c24] border border-[#31353e]/60 text-[#dfe2ee]'
                      : 'bg-[#229ed9] text-white'
                  }`}
                >
                  {/* Sender and time */}
                  <div className="flex items-center justify-between gap-3 text-[10px] text-[#8c909f] pb-1 border-b border-[#31353e]/40 font-mono">
                    <span
                      className={`font-semibold ${
                        isBot ? 'text-[#adc6ff]' : 'text-white font-bold'
                      }`}
                    >
                      {msg.sender}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] opacity-85">
                      {msg.timestamp}
                      {!isBot && <CheckCheck className="w-3 h-3 text-sky-200" />}
                    </span>
                  </div>

                  {/* Message body (HTML formatted) */}
                  <div
                    className="text-xs leading-relaxed whitespace-pre-line break-words"
                    dangerouslySetInnerHTML={{ __html: msg.text }}
                  />

                  {/* Interactive Inline Keyboard Buttons */}
                  {msg.buttons && (
                    <div className="pt-2 border-t border-[#31353e]/50">
                      <div className="text-[10px] font-mono font-semibold text-[#8c909f] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#fbbf24]" />
                        <span>Opciones de Estado Interactivas:</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {msg.buttons.map((btn, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleButtonClick(btn.orderId, btn.status)}
                            disabled={isProcessing}
                            className="py-2 px-2 rounded-lg bg-[#0a0e16] hover:bg-[#229ed9] border border-[#31353e] hover:border-[#229ed9] text-[#dfe2ee] hover:text-white text-xs font-mono font-bold transition flex items-center justify-center gap-1 shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                            type="button"
                          >
                            <span>{btn.text}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {!isBot && (
                  <div className="w-8 h-8 rounded-full bg-[#1c2028] border border-[#31353e]/60 text-[#dfe2ee] flex items-center justify-center flex-shrink-0 text-xs font-mono font-bold mt-1">
                    {selectedUser.charAt(1).toUpperCase()}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={chatBottomRef} />
        </div>

        {/* Quick Commands Bar */}
        <div className="px-4 py-2 bg-[#181c24] border-t border-[#31353e]/50 flex items-center gap-2 overflow-x-auto text-xs font-mono">
          <span className="text-[11px] text-[#8c909f] whitespace-nowrap">Comandos rápidos:</span>
          <button
            onClick={() => handleSendMessage('/ordenes')}
            className="px-2.5 py-1 rounded bg-[#0a0e16] hover:bg-[#262a33] text-[#dfe2ee] text-[11px] border border-[#31353e]/50 transition cursor-pointer"
            type="button"
          >
            /ordenes
          </button>
          <button
            onClick={() =>
              handleSendMessage(
                '/nuevaorden Migración de SSL | Actualizar certificados wildcard | urgente | @cmendoza_dev'
              )
            }
            className="px-2.5 py-1 rounded bg-[#0a0e16] hover:bg-[#262a33] text-[#dfe2ee] text-[11px] border border-[#31353e]/50 transition whitespace-nowrap cursor-pointer"
            type="button"
          >
            + /nuevaorden (Ejemplo Urgente)
          </button>
          <button
            onClick={() => handleSendMessage('/ayuda')}
            className="px-2.5 py-1 rounded bg-[#0a0e16] hover:bg-[#262a33] text-[#dfe2ee] text-[11px] border border-[#31353e]/50 transition cursor-pointer"
            type="button"
          >
            /ayuda
          </button>
        </div>

        {/* Chat Input Bar */}
        <div className="p-3 bg-[#181c24] border-t border-[#31353e]/60 flex items-center gap-2">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={`Escribe un mensaje o comando como ${selectedUser}...`}
            className="flex-1 px-4 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff]"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isProcessing || !inputVal.trim()}
            className="p-2.5 rounded-lg bg-[#229ed9] hover:bg-[#1c8ec4] text-white transition disabled:opacity-50 cursor-pointer"
            title="Enviar mensaje al bot"
            type="button"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
