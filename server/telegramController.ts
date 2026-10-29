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
  const assignedName = order.assignedTo?.name || 'Sin asignar';
  const assignedHandle = order.assignedTo?.telegramUser ? ` · ${order.assignedTo.telegramUser}` : '';

  const start = new Date(order.createdAt);
  const due = new Date(order.dueDate);

  const pad = (value: number) => String(value).padStart(2, '0');
  const shortDate = (date: Date) =>
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;

  const startLabel = shortDate(start);
  const dueLabel = shortDate(due);

  // Plazo: en horas cuando el superior asignó 48 h o menos; en días cuando el plazo es mayor.
  const windowHours = Math.max(0, (due.getTime() - start.getTime()) / 3_600_000);
  const useHours = windowHours <= 48;

  const remainingMs = due.getTime() - Date.now();
  const remainingHours = Math.abs(remainingMs) / 3_600_000;
  const hours = Math.max(1, Math.ceil(remainingHours));
  const days = Math.max(1, Math.ceil(remainingHours / 24));
  const amount = useHours ? `${hours} h` : days === 1 ? '1 día' : `${days} días`;

  const countdown =
    remainingMs < 0
      ? `⚠️ <b>Vencida</b> hace ${amount}`
      : `⏳ <b>Quedan ${amount}</b> para cumplir la orden`;

  const text =
    `👤 <b>${assignedName}</b>${assignedHandle}\n\n` +
    `📌 <b>${order.title}</b>\n` +
    `${order.description}\n\n` +
    `<pre>INICIO         VENCE\n${startLabel}  ${dueLabel}</pre>\n` +
    `${countdown}\n\n` +
    `👇 <i>Actualizá el estado de la orden:</i>`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '👀 En cuenta', callback_data: `status:${order.id}:en_cuenta` },
        { text: '✅ Orden finalizada', callback_data: `status:${order.id}:finalizada` },
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
  private memberSyncTimer?: ReturnType<typeof setInterval>;

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
   * Verifica si quien escribe es administrador del grupo o está en TELEGRAM_ADMIN_IDS.
   */
  private async isPrivilegedSender(
    token: string,
    chatId: string | number,
    userId?: number,
    username?: string
  ): Promise<boolean> {
    const allowed = (process.env.TELEGRAM_ADMIN_IDS || '')
      .split(',')
      .map((value) => value.trim().replace(/^@/, '').toLowerCase())
      .filter(Boolean);

    if (username && allowed.includes(username.toLowerCase())) return true;
    if (userId && allowed.includes(String(userId))) return true;

    if (!token || !chatId || !userId) return false;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/getChatMember?chat_id=${chatId}&user_id=${userId}`
      );
      const data = (await response.json()) as any;
      const status = data?.result?.status;
      return status === 'creator' || status === 'administrator';
    } catch {
      return false;
    }
  }

  /**
   * Crea o actualiza un integrante a partir de un usuario de Telegram.
   */
  private upsertTelegramMember(
    user: any,
    extra: { role?: string; seenAt?: string } = {}
  ): { status: 'created' | 'updated' | 'unchanged'; name: string } {
    const palette = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#6366F1'];
    const username = user.username ? `@${user.username}` : '';
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    const fallbackName = username || `Integrante ${user.id}`;
    const seenAt = extra.seenAt;

    const existing = this.db.members.find(
      (member) =>
        (username && member.telegramUser.toLowerCase() === username.toLowerCase()) ||
        (member.telegramChatId && String(member.telegramChatId) === String(user.id)) ||
        (fullName && member.name.toLowerCase() === fullName.toLowerCase())
    );

    if (existing) {
      const nextName = fullName || existing.name;
      const nextUser = username || existing.telegramUser;
      const lastSeenStale =
        Boolean(seenAt) &&
        (!existing.lastSeenAt || Date.now() - new Date(existing.lastSeenAt).getTime() > 3_600_000);

      const changed =
        existing.name !== nextName ||
        existing.telegramUser !== nextUser ||
        String(existing.telegramChatId ?? '') !== String(user.id) ||
        lastSeenStale;

      existing.name = nextName;
      existing.telegramUser = nextUser;
      existing.telegramChatId = user.id;
      if (seenAt) existing.lastSeenAt = seenAt;

      return { status: changed ? 'updated' : 'unchanged', name: nextName };
    }

    this.db.members.push({
      id: `mem-tg-${user.id}`,
      name: fullName || fallbackName,
      telegramUser: username || `tg:${user.id}`,
      telegramChatId: user.id,
      role: extra.role || 'Integrante del grupo',
      email: '',
      status: 'activo',
      color: palette[this.db.members.length % palette.length],
      ...(seenAt ? { lastSeenAt: seenAt } : {}),
    });

    return { status: 'created', name: fullName || fallbackName };
  }

  /**
   * Registra la interacción de un integrante en el grupo (alta o refresco).
   */
  private trackGroupParticipant(from: any, chatType?: string): boolean {
    if (!from || from.is_bot) return false;
    if (chatType !== 'group' && chatType !== 'supergroup') return false;

    const result = this.upsertTelegramMember(from, {
      role: 'Integrante del grupo',
      seenAt: new Date().toISOString(),
    });
    if (result.status === 'unchanged') return false;

    this.saveDb(this.db);
    if (this.io) this.io.emit('mirror:members_updated', { members: this.db.members });
    sseManager.broadcast('members_updated', { members: this.db.members });
    return true;
  }

  /**
   * Barrido del grupo: sincroniza los integrantes que la Bot API permite leer
   * (administradores y creador) con la lista de integrantes del sistema.
   */
  public async syncGroupMembers(chatId: string | number, requestedBy: string) {
    const token = this.db.telegramConfig.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    if (!token) return { ok: false as const, reason: 'Sin token de bot configurado' };

    const call = async (method: string) => {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/${method}?chat_id=${chatId}`
      );
      return (await response.json()) as any;
    };

    const adminsResponse = await call('getChatAdministrators');
    if (!adminsResponse?.ok) {
      return {
        ok: false as const,
        reason: adminsResponse?.description || 'No se pudo leer la lista del grupo',
      };
    }

    const countResponse = await call('getChatMemberCount');
    const groupCount = countResponse?.ok ? Number(countResponse.result) : undefined;

    let created = 0;
    let updated = 0;
    let unchanged = 0;
    const createdNames: string[] = [];

    for (const entry of adminsResponse.result as any[]) {
      const user = entry?.user;
      if (!user || user.is_bot) continue;

      const result = this.upsertTelegramMember(user, {
        role:
          entry.custom_title ||
          (entry.status === 'creator' ? 'Creador del grupo' : 'Administrador'),
      });

      if (result.status === 'created') {
        created += 1;
        createdNames.push(result.name);
      } else if (result.status === 'updated') {
        updated += 1;
      } else {
        unchanged += 1;
      }
    }

    const log: ActivityLog = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: requestedBy,
      action: 'Integrantes sincronizados desde Telegram',
      details: `Barrido del grupo: ${created} nuevos, ${updated} actualizados, ${unchanged} sin cambios.`,
      type: 'member',
    };
    this.db.activity.unshift(log);
    this.saveDb(this.db);

    if (this.io) {
      this.io.emit('mirror:members_updated', { members: this.db.members });
      this.io.emit('mirror:activity_logged', log);
      this.io.emit('mirror:telegram_event', { type: 'members_synced' });
    }
    sseManager.broadcast('members_updated', { members: this.db.members });
    sseManager.broadcast('activity_logged', log);

    return {
      ok: true as const,
      created,
      updated,
      unchanged,
      createdNames,
      total: this.db.members.length,
      groupCount,
    };
  }

  /**
   * Barrido automático diario: mantiene la lista al día sin intervención.
   */
  public startDailyMemberSync(intervalHours = 24) {
    if (this.memberSyncTimer) return;

    const run = async () => {
      const token = this.db.telegramConfig.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
      const chatId = this.db.telegramConfig.groupChatId || process.env.TELEGRAM_GROUP_CHAT_ID || '';
      if (!token || !chatId) return;

      const summary = await this.syncGroupMembers(chatId, 'Barrido automático diario');
      if (summary.ok) {
        console.log(
          `[Telegram] Barrido diario de integrantes: ${summary.created} nuevos, ${summary.updated} actualizados, ${summary.unchanged} sin cambios.`
        );
      } else {
        console.warn(`[Telegram] Barrido diario omitido: ${summary.reason}`);
      }
    };

    setTimeout(() => void run(), 60_000);
    this.memberSyncTimer = setInterval(
      () => void run(),
      Math.max(1, intervalHours) * 3_600_000
    );
  }

  /**
   * Procesa updates entrantes (Webhook o Poller en vivo)
   */
  public async handleUpdate(update: any) {
    if (!update) return { ok: false, error: 'Empty update' };
    const token = this.db.telegramConfig.botToken || process.env.TELEGRAM_BOT_TOKEN || '';

    // 0. Registro pasivo de integrantes que interactúan en el grupo
    if (update.message?.from) {
      this.trackGroupParticipant(update.message.from, update.message.chat?.type);
    }
    if (update.callback_query?.from) {
      this.trackGroupParticipant(
        update.callback_query.from,
        update.callback_query.message?.chat?.type
      );
    }

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
          `• <code>/actualizar</code> - Sincronizar integrantes del grupo (solo admin/desarrollador)\n` +
          `• <code>/ayuda</code> - Ver instrucciones\n\n` +
          `👇 <i>Todas las órdenes cuentan con botones directos [En cuenta] y [Orden finalizada].</i>`;

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

      if (text === '/actualizar' || text.startsWith('/actualizar ')) {
        const chatType = msg.chat.type;
        if (chatType !== 'group' && chatType !== 'supergroup') {
          await sendTelegramMessage(
            token,
            chatId,
            '⚠️ <b>/actualizar</b> solo funciona dentro del grupo de trabajo.'
          );
          return { ok: false, command: 'actualizar', error: 'not_a_group' };
        }

        const allowed = await this.isPrivilegedSender(token, chatId, msg.from?.id, msg.from?.username);
        if (!allowed) {
          await sendTelegramMessage(
            token,
            chatId,
            `⛔ <b>Acción restringida</b>\nSolo administradores y desarrolladores pueden ejecutar /actualizar.`
          );
          return { ok: false, command: 'actualizar', error: 'unauthorized' };
        }

        const summary = await this.syncGroupMembers(chatId, fromUser);
        if (!summary.ok) {
          await sendTelegramMessage(
            token,
            chatId,
            `⚠️ No se pudo actualizar la lista de integrantes: ${summary.reason}`
          );
          return { ok: false, command: 'actualizar', error: summary.reason };
        }

        const reply =
          `🔄 <b>INTEGRANTES ACTUALIZADOS</b>\n\n` +
          `• Nuevos: <b>${summary.created}</b>\n` +
          `• Actualizados: <b>${summary.updated}</b>\n` +
          `• Sin cambios: <b>${summary.unchanged}</b>\n` +
          `• Total en el sistema: <b>${summary.total}</b>\n` +
          (summary.groupCount ? `• Miembros en el grupo: <b>${summary.groupCount}</b>\n` : '') +
          (summary.createdNames.length
            ? `\n<b>Se sumaron:</b>\n${summary.createdNames.map((name) => `• ${name}`).join('\n')}\n`
            : '') +
          `\n✅ La lista ya quedó actualizada en la consola web.`;

        await sendTelegramMessage(token, chatId, reply);
        return { ok: true, command: 'actualizar', summary };
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
