import { Request, Response, NextFunction } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { Order, Member, ActivityLog, OrderStatus, TelegramConfig } from '../src/types.js';
import { sseManager } from './sseManager.js';

export interface DatabaseState {
  orders: Order[];
  members: Member[];
  activity: ActivityLog[];
  telegramConfig: TelegramConfig;
}

/**
 * Middleware para validar solicitudes entrantes de Webhook de Telegram
 */
export function telegramAuthMiddleware(secretToken?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!secretToken) return next();
    const incomingHeader = req.headers['x-telegram-bot-api-secret-token'];
    if (incomingHeader && incomingHeader !== secretToken) {
      return res.status(403).json({ error: 'Firma de Webhook de Telegram inválida' });
    }
    next();
  };
}

/**
 * Helper principal para emitir mensajes vía Telegram Bot API
 */
export async function sendTelegramMessage(
  token: string,
  chatId: string | number,
  text: string,
  replyMarkup?: any
) {
  if (!token) {
    return {
      success: false,
      simulated: true,
      message: 'Modo simulado activo (Sin token configurado).',
    };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const body: any = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = (await response.json()) as any;
    if (!result.ok) {
      console.warn('Telegram Bot API advertencia:', result.description);
      return { success: false, error: result.description };
    }
    return { success: true, messageId: result.result?.message_id };
  } catch (err: any) {
    console.error('Telegram Bot API error de red:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Construye la carga formateada en HTML y los botones táctiles inline
 */
export function buildOrderTelegramPayload(order: Order) {
  const priorityEmoji: Record<string, string> = {
    baja: '🟢 Baja',
    media: '🟡 Media',
    alta: '🟠 Alta',
    urgente: '🔴 Urgente',
  };

  const statusLabels: Record<string, string> = {
    recibida: '📥 Recibida',
    en_cuenta: '👀 En Cuenta',
    en_proceso: '⏳ En Proceso',
    finalizada: '✅ Finalizada',
  };

  const dueFormatted = new Date(order.dueDate).toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const assignedHandle = order.assignedTo
    ? `${order.assignedTo.name} (${order.assignedTo.telegramUser})`
    : 'Sin asignar';

  const text =
    `📋 <b>ORDEN DE GESTIÓN: #${order.id}</b>\n\n` +
    `<b>Título:</b> ${order.title}\n` +
    `<b>Prioridad:</b> ${priorityEmoji[order.priority] || order.priority}\n` +
    `<b>Estado Actual:</b> ${statusLabels[order.status] || order.status}\n` +
    `<b>Asignada a:</b> ${assignedHandle}\n` +
    `<b>Fecha Límite:</b> ⏰ ${dueFormatted}\n` +
    (order.department ? `<b>Área/Dpto:</b> ${order.department}\n` : '') +
    `\n<b>Descripción:</b>\n<i>${order.description}</i>\n\n` +
    `👇 <i>Selecciona una opción para actualizar el estado en tiempo real:</i>`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '📥 En Cuenta', callback_data: `status:${order.id}:en_cuenta` },
        { text: '⏳ En Proceso', callback_data: `status:${order.id}:en_proceso` },
        { text: '✅ Finalizada', callback_data: `status:${order.id}:finalizada` },
      ],
    ],
  };

  return { text, reply_markup: inlineKeyboard };
}

/**
 * Controlador de Telegram
 */
export class TelegramController {
  private db: DatabaseState;
  private io?: SocketIOServer;
  private saveDb: (db: DatabaseState) => void;

  constructor(db: DatabaseState, saveDb: (db: DatabaseState) => void, io?: SocketIOServer) {
    this.db = db;
    this.saveDb = saveDb;
    this.io = io;
  }

  public setSocketServer(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Despacha una orden recién creada al grupo/chat de Telegram
   */
  public async dispatchOrderNotification(order: Order, targetChatId?: string | number) {
    const token = this.db.telegramConfig.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    const chat = targetChatId || this.db.telegramConfig.groupChatId;
    if (!token || !chat) return { success: false, reason: 'No token or chat configured' };

    const payload = buildOrderTelegramPayload(order);
    const result = await sendTelegramMessage(token, chat, payload.text, payload.reply_markup);

    if (result.messageId) {
      order.telegramMessageId = result.messageId;
      this.saveDb(this.db);
    }
    return result;
  }

  /**
   * Procesa updates entrantes (Webhook o Poller en vivo)
   */
  public async handleUpdate(update: any) {
    if (!update) return { ok: false, error: 'Empty update' };
    const token = this.db.telegramConfig.botToken || process.env.TELEGRAM_BOT_TOKEN || '';

    // 1. Manejo de botones de acción rápida [En Cuenta], [En Proceso], [Finalizada]
    if (update.callback_query) {
      const cq = update.callback_query;
      const data = cq.data || '';
      const fromUser = cq.from?.username
        ? `@${cq.from.username}`
        : cq.from?.first_name || 'Usuario Telegram';
      const chatId = cq.message?.chat?.id;

      if (data.startsWith('status:')) {
        const parts = data.split(':');
        const orderId = parts[1];
        const newStatus = parts[2] as OrderStatus;

        const order = this.db.orders.find((o) => o.id === orderId);
        if (order) {
          const oldStatus = order.status;
          order.status = newStatus;
          order.updatedAt = new Date().toISOString();
          if (newStatus === 'finalizada') {
            order.completedAt = new Date().toISOString();
          }

          const statusNames: Record<string, string> = {
            recibida: '📥 RECIBIDA',
            en_cuenta: '👀 EN CUENTA',
            en_proceso: '⏳ EN PROCESO',
            finalizada: '✅ FINALIZADA',
          };

          const log: ActivityLog = {
            id: `act-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actor: fromUser,
            action: 'Actualización por Botón Telegram',
            orderId: order.id,
            orderTitle: order.title,
            details: `El integrante ${fromUser} cambió el estado de #${order.id} de "${oldStatus}" a "${statusNames[newStatus] || newStatus}".`,
            type: 'status_change',
          };

          this.db.activity.unshift(log);
          this.saveDb(this.db);

          // ⚡ Sincronización instantánea a todas las pantallas conectadas (Espejo en vivo)
          if (this.io) {
            this.io.emit('mirror:order_updated', order);
            this.io.emit('mirror:activity_logged', log);
            this.io.emit('mirror:telegram_event', {
              type: 'callback_status_updated',
              orderId,
              newStatus,
              fromUser,
            });
          }
          sseManager.broadcast('order_updated', order);
          sseManager.broadcast('activity_logged', log);
          sseManager.broadcast('telegram_event', {
            type: 'callback_status_updated',
            orderId,
            newStatus,
            fromUser,
          });

          // Responder a Telegram
          if (token && cq.id) {
            try {
              await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  callback_query_id: cq.id,
                  text: `✅ Orden #${order.id}: ${statusNames[newStatus] || newStatus}`,
                  show_alert: false,
                }),
              });
            } catch (e) {
              console.error('Error answering callback query:', e);
            }
          }

          // Notificar al chat grupal del cambio
          if (chatId) {
            const updateAlert =
              `⚡ <b>ESTADO ACTUALIZADO EN TIEMPO REAL</b>\n` +
              `El integrante <b>${fromUser}</b> actualizó la orden <b>#${order.id}</b>:\n` +
              `<b>Título:</b> ${order.title}\n` +
              `<b>Nuevo Estado:</b> <b>${statusNames[newStatus] || newStatus}</b>`;
            await sendTelegramMessage(token, chatId, updateAlert);
          }

          return { ok: true, status: 'updated', orderId, newStatus };
        }
      }
    }

    // 2. Manejo de Mensajes de Texto y Comandos (/nuevaorden, /ordenes, /ayuda)
    if (update.message && update.message.text) {
      const msg = update.message;
      const text = msg.text.trim();
      const fromUser = msg.from?.username
        ? `@${msg.from.username}`
        : msg.from?.first_name || 'Usuario Telegram';
      const chatId = msg.chat.id;

      if (text === '/start' || text.startsWith('/ayuda') || text.startsWith('/help')) {
        const helpText =
          `🤖 <b>NÚCLEO CONTROL • Bot de Gestión Operativa</b>\n\n` +
          `Este bot sincroniza en espejo las órdenes de trabajo con la consola central de PC y Móvil.\n\n` +
          `<b>Comandos de Operadores:</b>\n` +
          `• <code>/nuevaorden [Título] | [Descripción] | [baja/media/alta/urgente] | [@usuario]</code>\n` +
          `• <code>/ordenes</code> - Listar órdenes pendientes asignadas\n` +
          `• <code>/ayuda</code> - Ver instrucciones\n\n` +
          `👇 <i>Todas las órdenes cuentan con botones directos [En Cuenta], [En Proceso] y [Finalizada].</i>`;

        await sendTelegramMessage(token, chatId, helpText);
        return { ok: true, command: 'help' };
      }

      if (text.startsWith('/ordenes')) {
        const pending = this.db.orders.filter((o) => o.status !== 'finalizada').slice(0, 8);
        if (pending.length === 0) {
          await sendTelegramMessage(token, chatId, '✅ ¡No hay órdenes pendientes en este momento! Todas están finalizadas.');
        } else {
          let msgList = `📋 <b>Órdenes Activas Pendientes (${pending.length}):</b>\n\n`;
          pending.forEach((o) => {
            const prio = o.priority.toUpperCase();
            const assigned = o.assignedTo
              ? `${o.assignedTo.name} (${o.assignedTo.telegramUser})`
              : 'Sin asignar';
            const due = new Date(o.dueDate).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            });
            msgList += `• <b>#${o.id}</b>: ${o.title}\n  Estado: [${o.status.toUpperCase()}] | Prioridad: ${prio}\n  Asignado: ${assigned} | Límite: ⏰ ${due}\n\n`;
          });
          await sendTelegramMessage(token, chatId, msgList);
        }
        return { ok: true, command: 'ordenes' };
      }

      if (text.startsWith('/nuevaorden') || text.toLowerCase().startsWith('orden:')) {
        const content = text.replace(/^\/nuevaorden\s*/i, '').replace(/^orden:\s*/i, '');
        const parts = content.split('|').map((p: string) => p.trim());

        const title = parts[0] || 'Nueva orden desde Telegram';
        const description = parts[1] || 'Registrada directamente por Telegram Bot';
        const priorityRaw = (parts[2] || 'media').toLowerCase();
        const priority = ['baja', 'media', 'alta', 'urgente'].includes(priorityRaw)
          ? (priorityRaw as any)
          : 'media';
        const assignedTarget = parts[3] || '';

        let assignedMember: Member | null = null;
        if (assignedTarget) {
          assignedMember =
            this.db.members.find(
              (m) =>
                m.telegramUser.toLowerCase() === assignedTarget.toLowerCase() ||
                m.name.toLowerCase().includes(assignedTarget.toLowerCase())
            ) || null;
        }

        const nextNum = 1000 + this.db.orders.length + 1;
        const newOrder: Order = {
          id: `ORD-${nextNum}`,
          title,
          description,
          origin: 'telegram',
          status: 'recibida',
          priority,
          assignedTo: assignedMember,
          createdBy: `Telegram Bot (${fromUser})`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          dueDate: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
          telegramChatId: chatId,
          remindersCount: 0,
          notes: [],
        };

        this.db.orders.unshift(newOrder);

        const log: ActivityLog = {
          id: `act-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: fromUser,
          action: 'Recepción de Orden por Telegram',
          orderId: newOrder.id,
          orderTitle: newOrder.title,
          details: `Orden #${newOrder.id} recibida desde Telegram por ${fromUser}. Asignada a: ${assignedMember ? assignedMember.name : 'Sin asignar'}.`,
          type: 'order_created',
        };
        this.db.activity.unshift(log);
        this.saveDb(this.db);

        // ⚡ Reflejo en tiempo real a clientes Web / Móvil
        if (this.io) {
          this.io.emit('mirror:order_created', newOrder);
          this.io.emit('mirror:activity_logged', log);
          this.io.emit('mirror:telegram_event', {
            type: 'order_created_from_telegram',
            order: newOrder,
            fromUser,
          });
        }
        sseManager.broadcast('order_created', newOrder);
        sseManager.broadcast('activity_logged', log);
        sseManager.broadcast('telegram_event', {
          type: 'order_created_from_telegram',
          order: newOrder,
          fromUser,
        });

        const payload = buildOrderTelegramPayload(newOrder);
        await sendTelegramMessage(
          token,
          chatId,
          `✅ <b>¡Orden #${newOrder.id} registrada en el sistema central!</b>\n\n${payload.text}`,
          payload.reply_markup
        );

        return { ok: true, createdOrder: newOrder };
      }
    }

    return { ok: true, message: 'Update handled' };
  }

  /**
   * Endpoint Handler: Envío de recordatorios
   */
  public handleSendReminder = async (req: Request, res: Response) => {
    const { orderId, targetType, customMessage, memberId } = req.body;
    const token = this.db.telegramConfig.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    let sentCount = 0;

    if (targetType === 'all_pending') {
      const pendingOrders = this.db.orders.filter((o) => o.status !== 'finalizada');
      for (const order of pendingOrders) {
        const targetChat = order.assignedTo?.telegramChatId || this.db.telegramConfig.groupChatId;
        if (targetChat) {
          order.remindersCount = (order.remindersCount || 0) + 1;
          order.lastReminderAt = new Date().toISOString();

          const reminderMsg =
            `🔔 <b>RECORDATORIO AUTOMÁTICO DE TAREA PENDIENTE</b>\n\n` +
            `<b>Orden:</b> #${order.id} - ${order.title}\n` +
            `<b>Estado:</b> ${order.status.toUpperCase()}\n` +
            `<b>Asignado a:</b> ${order.assignedTo ? order.assignedTo.name : 'Sin Asignar'}\n` +
            `<b>Fecha Límite:</b> ⏰ ${new Date(order.dueDate).toLocaleString('es-ES')}\n` +
            (customMessage ? `\n📌 <i>Mensaje:</i>\n${customMessage}\n` : '') +
            `\nPor favor actualicen su avance utilizando los botones inline.`;

          const payload = buildOrderTelegramPayload(order);
          await sendTelegramMessage(token, targetChat, reminderMsg, payload.reply_markup);
          sentCount++;
        }
      }

      const log: ActivityLog = {
        id: `act-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: 'Administrador (Panel)',
        action: 'Recordatorio Masivo Telegram',
        details: `Se emitieron ${sentCount} recordatorios push a integrantes vía Telegram.`,
        type: 'reminder_sent',
      };
      this.db.activity.unshift(log);

      if (this.io) {
        this.io.emit('mirror:activity_logged', log);
      }
    } else if (orderId) {
      const order = this.db.orders.find((o) => o.id === orderId);
      if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

      const member = memberId ? this.db.members.find((m) => m.id === memberId) : order.assignedTo;
      const targetChat = member?.telegramChatId || this.db.telegramConfig.groupChatId;

      order.remindersCount = (order.remindersCount || 0) + 1;
      order.lastReminderAt = new Date().toISOString();

      const text =
        `🔔 <b>RECORDATORIO DE ORDEN #${order.id}</b>\n\n` +
        `Estimado(a) <b>${member ? member.name : 'Equipo'}</b> (${member ? member.telegramUser : '@todos'}):\n` +
        `Seguimiento de orden:\n` +
        `<b>Título:</b> ${order.title}\n` +
        `<b>Estado Actual:</b> ${order.status.toUpperCase()}\n` +
        `<b>Fecha Límite:</b> ⏰ ${new Date(order.dueDate).toLocaleString('es-ES')}\n\n` +
        (customMessage ? `📌 <b>Mensaje:</b>\n<i>${customMessage}</i>\n\n` : '') +
        `Favor actualizar estado con los botones táctiles:`;

      const payload = buildOrderTelegramPayload(order);
      await sendTelegramMessage(token, targetChat, text, payload.reply_markup);

      const log: ActivityLog = {
        id: `act-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: 'Administrador (Panel)',
        action: 'Recordatorio Personalizado',
        orderId: order.id,
        orderTitle: order.title,
        details: `Recordatorio despachado a ${member ? member.name : 'Grupo'} (${member ? member.telegramUser : 'Canal'}).`,
        type: 'reminder_sent',
      };
      this.db.activity.unshift(log);

      if (this.io) {
        this.io.emit('mirror:order_updated', order);
        this.io.emit('mirror:activity_logged', log);
      }

      sentCount = 1;
    }

    this.saveDb(this.db);
    res.json({ success: true, sentCount });
  };

  /**
   * Endpoint Handler: Notificación Push General al grupo
   */
  public handleBroadcast = async (req: Request, res: Response) => {
    const { title, message, priority = 'normal' } = req.body;
    if (!message) return res.status(400).json({ error: 'El mensaje es requerido' });

    const token = this.db.telegramConfig.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    const priorityHeader =
      priority === 'urgente' ? '🚨 COMUNICADO URGENTE' : '📢 AVISO GENERAL DE CONTROL DE GESTIÓN';
    const text =
      `<b>${priorityHeader}</b>\n` +
      (title ? `<b>${title}</b>\n\n` : '\n') +
      `${message}\n\n` +
      `<i>Emitido desde la Consola Central</i>`;

    const targetChat = this.db.telegramConfig.groupChatId || '-1002692322280';
    const tgRes = await sendTelegramMessage(token, targetChat, text);

    const log: ActivityLog = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: 'Administrador',
      action: 'Comunicado General Telegram',
      details: `Mensaje emitido al canal: "${title || message.substring(0, 40)}"`,
      type: 'telegram_sync',
    };
    this.db.activity.unshift(log);
    this.saveDb(this.db);

    if (this.io) {
      this.io.emit('mirror:activity_logged', log);
    }

    res.json({ success: true, response: tgRes });
  };
}
