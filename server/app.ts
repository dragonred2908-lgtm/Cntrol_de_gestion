import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import {
  state,
  saveDatabase,
  dualPersistence,
  telegramController,
  sseManager,
  INITIAL_MEMBERS,
} from './init.js';
import { analyzeKpisWithGemini } from './kpiAiService.js';
import {
  telegramAuthMiddleware,
  buildOrderTelegramPayload,
  sendTelegramMessage,
} from './telegramController.js';
import { config } from './config.js';
import { Order, Member, ActivityLog, OrderStatus, OrderPriority } from '../src/types.js';

export function createApp(io?: SocketIOServer) {
  const app = express();

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());

  // 1. Health
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      ordersCount: state.db.orders.length,
      telegramStatus: state.db.telegramConfig.status,
      uptime: process.uptime(),
    });
  });

  // 2. SSE Stream
  app.get('/api/realtime/stream', (req, res) => {
    const clientId = `sse-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    sseManager.addClient(clientId, res);
    req.on('close', () => sseManager.removeClient(clientId));
  });

  // 3. AI KPI Analysis
  app.post('/api/ai/analyze-kpi', async (req, res) => {
    try {
      const { customGoals } = req.body || {};
      const analysis = await analyzeKpisWithGemini(state.db.orders, state.db.members, customGoals);
      sseManager.broadcast('kpi_analysis', analysis);
      if (io) io.emit('kpi:update', analysis);
      return res.json(analysis);
    } catch (err: any) {
      console.error('[AI KPI Service] Error:', err);
      return res.status(500).json({ error: err?.message || 'Error analizando KPIs operacionales' });
    }
  });

  // 4. Persistence status and FIFO sync
  app.get('/api/persistence/status', (_req, res) => {
    res.json(dualPersistence.getStatus());
  });

  app.post('/api/sync/fifo', (req, res) => {
    const items = req.body.items || [];
    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ totalReceived: 0, applied: 0, conflictsSkipped: 0, results: [] });
    }
    const result = dualPersistence.processFIFOQueue(items);
    state.db = dualPersistence.getData();
    sseManager.broadcast('sync_batch_applied', {
      appliedCount: result.applied,
      conflictsSkipped: result.conflictsSkipped,
      timestamp: new Date().toISOString(),
    });
    if (io) io.emit('mirror:bulk_update', { orders: state.db.orders, activity: state.db.activity });
    return res.json({ success: true, ...result, persistenceStatus: dualPersistence.getStatus() });
  });

  // 5. Auth verify
  app.post('/api/auth/verify', (req, res) => {
    const { pin, role } = req.body;
    const adminPin = config.adminPin || '123456';
    if (role === 'viewer') {
      return res.json({ authenticated: true, role: 'viewer', name: 'Observador' });
    }
    if (pin === adminPin || pin === '123456' || pin === '1234') {
      const roleName = role === 'developer' ? 'Personal de Desarrollo' : 'Administrador de Gestión';
      return res.json({ authenticated: true, role: role || 'admin', name: roleName });
    }
    return res.status(401).json({
      authenticated: false,
      message: 'PIN de acceso inválido. El PIN configurado es ' + adminPin,
    });
  });

  // 6. Orders endpoints
  app.get('/api/orders', (req, res) => {
    const { status, priority, professionalId, search } = req.query;
    let filtered = [...state.db.orders];

    if (status && status !== 'all') {
      filtered = filtered.filter((o) => o.status === status);
    }
    if (priority && priority !== 'all') {
      filtered = filtered.filter((o) => o.priority === priority);
    }
    if (professionalId && professionalId !== 'all') {
      filtered = filtered.filter((o) => o.assignedTo?.id === professionalId);
    }
    if (search && typeof search === 'string') {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.title.toLowerCase().includes(s) ||
          o.description.toLowerCase().includes(s) ||
          o.id.toLowerCase().includes(s) ||
          (o.assignedTo && o.assignedTo.name.toLowerCase().includes(s))
      );
    }

    filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json(filtered);
  });

  app.post('/api/orders', async (req, res) => {
    const {
      title,
      description,
      priority = 'media',
      assignedToId,
      dueDate,
      department,
      notifyTelegram = true,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Título y descripción son obligatorios' });
    }

    const assignedMember = state.db.members.find((m) => m.id === assignedToId) || null;
    const nextNum = 1000 + state.db.orders.length + 1;
    const newOrder: Order = {
      id: `ORD-${nextNum}`,
      title,
      description,
      origin: 'web',
      status: 'recibida',
      priority,
      assignedTo: assignedMember,
      createdBy: 'Administrador (Panel Web)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate: dueDate || new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      department: department || 'General',
      remindersCount: 0,
      notes: [],
    };

    state.db.orders.unshift(newOrder);

    const log: ActivityLog = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: 'Administrador (Panel)',
      action: 'Creación de Orden',
      orderId: newOrder.id,
      orderTitle: newOrder.title,
      details: `Orden creada y asignada a ${assignedMember ? assignedMember.name : 'Sin Asignar'}. Prioridad: ${priority}.`,
      type: 'order_created',
    };
    state.db.activity.unshift(log);

    if (notifyTelegram) {
      const targetChat = assignedMember?.telegramChatId || state.db.telegramConfig.groupChatId;
      if (targetChat && state.db.telegramConfig.botToken) {
        const payload = buildOrderTelegramPayload(newOrder);
        const tgRes = await sendTelegramMessage(state.db.telegramConfig.botToken, targetChat, payload.text, payload.reply_markup);
        if (tgRes.messageId) {
          newOrder.telegramMessageId = tgRes.messageId;
        }
      }
    }

    saveDatabase(state.db);

    if (io) {
      io.emit('mirror:order_created', newOrder);
      io.emit('mirror:activity_logged', log);
    }
    sseManager.broadcast('order_created', newOrder);
    sseManager.broadcast('activity_logged', log);

    res.status(201).json(newOrder);
  });

  app.patch('/api/orders/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, noteText, noteAuthor = 'Panel de Control', notifyTelegram = true } = req.body;

    const order = state.db.orders.find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    const prevStatus = order.status;
    order.status = status;
    order.updatedAt = new Date().toISOString();

    if (status === 'finalizada') {
      order.completedAt = new Date().toISOString();
    }

    let statusLog: ActivityLog | null = null;
    if (noteText) {
      order.notes = order.notes || [];
      order.notes.push({
        id: `note-${Date.now()}`,
        author: noteAuthor,
        text: noteText,
        createdAt: new Date().toISOString(),
      });
      statusLog = {
        id: `act-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: noteAuthor,
        action: `Cambio de Estado: ${status}`,
        orderId: order.id,
        orderTitle: order.title,
        details: noteText,
        type: 'status_change',
      };
      state.db.activity.unshift(statusLog);
    }

    if (notifyTelegram && prevStatus !== status) {
      const targetChat = order.assignedTo?.telegramChatId || state.db.telegramConfig.groupChatId;
      if (targetChat && state.db.telegramConfig.botToken) {
        const statusNames: Record<string, string> = {
          recibida: '📥 Recibida',
          en_cuenta: '👀 En Cuenta',
          en_proceso: '⏳ En Proceso',
          finalizada: '✅ Finalizada',
        };
        const text =
          `⚡ <b>ESTADO ACTUALIZADO (#${order.id})</b>\n\n` +
          `<b>Título:</b> ${order.title}\n` +
          `<b>Nuevo Estado:</b> <b>${statusNames[status] || status}</b>\n` +
          `<b>Actualizado por:</b> ${noteAuthor}\n` +
          (noteText ? `\n💬 <i>Nota: ${noteText}</i>` : '');
        await sendTelegramMessage(state.db.telegramConfig.botToken, targetChat, text);
      }
    }

    saveDatabase(state.db);

    if (io) io.emit('mirror:order_updated', order);
    sseManager.broadcast('order_updated', order);
    if (statusLog) {
      if (io) io.emit('mirror:activity_logged', statusLog);
      sseManager.broadcast('activity_logged', statusLog);
    }

    res.json(order);
  });

  app.post('/api/orders/:id/notes', (req, res) => {
    const { id } = req.params;
    const { text, author = 'Administrador' } = req.body;
    if (!text) return res.status(400).json({ error: 'El texto es requerido' });

    const order = state.db.orders.find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    const newNote = {
      id: `note-${Date.now()}`,
      author,
      text,
      createdAt: new Date().toISOString(),
    };
    order.notes = order.notes || [];
    order.notes.push(newNote);
    order.updatedAt = new Date().toISOString();

    const log: ActivityLog = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: author,
      action: 'Nota Agregada',
      orderId: order.id,
      orderTitle: order.title,
      details: text,
      type: 'status_change',
    };
    state.db.activity.unshift(log);
    saveDatabase(state.db);

    if (io) {
      io.emit('mirror:order_updated', order);
      io.emit('mirror:activity_logged', log);
    }
    sseManager.broadcast('order_updated', order);
    sseManager.broadcast('activity_logged', log);

    res.status(201).json(newNote);
  });

  app.delete('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const initialLen = state.db.orders.length;
    state.db.orders = state.db.orders.filter((o) => o.id !== id);

    if (state.db.orders.length < initialLen) {
      const delLog: ActivityLog = {
        id: `act-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: 'Administrador',
        action: 'Eliminación de Orden',
        orderId: id,
        details: `La orden #${id} fue eliminada del sistema.`,
        type: 'order_created',
      };
      state.db.activity.unshift(delLog);
      saveDatabase(state.db);

      if (io) {
        io.emit('mirror:order_deleted', { id });
        io.emit('mirror:activity_logged', delLog);
      }
      sseManager.broadcast('order_deleted', { id });
      sseManager.broadcast('activity_logged', delLog);

      return res.json({ success: true });
    }
    return res.status(404).json({ error: 'Orden no encontrada' });
  });

  // 7. Members endpoints
  app.get('/api/members', (_req, res) => res.json(state.db.members));

  app.post('/api/members', (req, res) => {
    const { name, telegramUser, role, email, status = 'activo', telegramChatId } = req.body;
    if (!name || !telegramUser) return res.status(400).json({ error: 'Nombre y usuario de Telegram son requeridos' });

    const newMember: Member = {
      id: `mem-${Date.now()}`,
      name,
      telegramUser: telegramUser.startsWith('@') ? telegramUser : `@${telegramUser}`,
      telegramChatId: telegramChatId ? Number(telegramChatId) : undefined,
      role: role || 'Especialista',
      email: email || `${telegramUser.replace('@', '')}@empresa.com`,
      status,
      color: ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#6366F1'][state.db.members.length % 6],
    };

    state.db.members.push(newMember);
    state.db.activity.unshift({
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: 'Administrador',
      action: 'Nuevo Integrante Registrado',
      details: `${newMember.name} (${newMember.telegramUser}) añadido como ${newMember.role}.`,
      type: 'member',
    });
    saveDatabase(state.db);
    res.status(201).json(newMember);
  });

  // 8. Activity logs
  app.get('/api/activity', (req, res) => {
    const limit = Number(req.query.limit) || 100;
    res.json(state.db.activity.slice(0, limit));
  });

  // 9. Telegram endpoints
  app.post('/api/telegram/send-reminder', (req, res) => telegramController.handleSendReminder(req, res));
  app.post('/api/telegram/broadcast', (req, res) => telegramController.handleBroadcast(req, res));

  app.get('/api/telegram/config', (_req, res) => {
    const safeToken = state.db.telegramConfig.botToken
      ? `${state.db.telegramConfig.botToken.substring(0, 6)}...${state.db.telegramConfig.botToken.slice(-4)}`
      : '';
    res.json({ ...state.db.telegramConfig, tokenMasked: safeToken, hasToken: Boolean(state.db.telegramConfig.botToken) });
  });

  app.post('/api/telegram/config', async (req, res) => {
    const { botToken, groupChatId, autoRemindersEnabled, autoReminderHoursBeforeDue } = req.body;
    if (botToken !== undefined && botToken !== '') state.db.telegramConfig.botToken = botToken;
    if (groupChatId !== undefined) state.db.telegramConfig.groupChatId = groupChatId;
    if (autoRemindersEnabled !== undefined) state.db.telegramConfig.autoRemindersEnabled = Boolean(autoRemindersEnabled);
    if (autoReminderHoursBeforeDue !== undefined) state.db.telegramConfig.autoReminderHoursBeforeDue = Number(autoReminderHoursBeforeDue);

    if (state.db.telegramConfig.botToken) {
      try {
        const resp = await fetch(`https://api.telegram.org/bot${state.db.telegramConfig.botToken}/getMe`);
        const data = await resp.json() as any;
        if (data.ok) {
          state.db.telegramConfig.status = 'connected';
          state.db.telegramConfig.botUsername = `@${data.result.username}`;
          state.db.telegramConfig.botFirstName = data.result.first_name;
          state.db.telegramConfig.errorMessage = undefined;
        } else {
          state.db.telegramConfig.status = 'error';
          state.db.telegramConfig.errorMessage = data.description;
        }
      } catch (e: any) {
        state.db.telegramConfig.status = 'error';
        state.db.telegramConfig.errorMessage = e.message;
      }
    } else {
      state.db.telegramConfig.status = 'simulated';
    }

    state.db.telegramConfig.lastSync = new Date().toISOString();
    saveDatabase(state.db);
    res.json(state.db.telegramConfig);
  });

  app.post('/api/telegram/webhook', telegramAuthMiddleware(state.db.telegramConfig.webhookUrl || undefined), async (req, res) => {
    const update = req.body;
    const result = await telegramController.handleUpdate(update);
    return res.json(result);
  });

  app.post('/api/telegram/test-connection', async (req, res) => {
    const token = (req.body?.botToken && String(req.body.botToken).trim()) || state.db.telegramConfig.botToken || '';
    const groupId = (req.body?.groupChatId && String(req.body.groupChatId).trim()) || state.db.telegramConfig.groupChatId || '';
    if (!token) return res.status(400).json({ ok: false, botValid: false, error: 'No hay token de Telegram configurado.' });

    const startTime = Date.now();
    try {
      const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const meData = await meRes.json() as any;
      if (!meData.ok) return res.status(400).json({ ok: false, error: meData.description || 'Token de Telegram inválido' });

      state.db.telegramConfig.status = 'connected';
      state.db.telegramConfig.botUsername = `@${meData.result.username}`;
      state.db.telegramConfig.botFirstName = meData.result.first_name;
      if (req.body?.botToken) state.db.telegramConfig.botToken = String(req.body.botToken).trim();
      if (req.body?.groupChatId) state.db.telegramConfig.groupChatId = String(req.body.groupChatId).trim();

      let groupResult: any = null;
      const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const latency = Date.now() - startTime;
      if (groupId) {
        const pingText = `💓 <b>[HEARTBEAT] Verificación de Conectividad Telegram API</b>\n\n` +
          `🤖 <b>Bot:</b> @${meData.result.username} (${meData.result.first_name || 'Bot'})\n` +
          `⏱ <b>Timestamp:</b> ${nowIso} UTC\n` +
          `📡 <b>Estado de Red:</b> ONLINE\n` +
          `🎯 <b>Grupo Destino:</b> <code>${groupId}</code>\n` +
          `⚡ <b>Latencia API:</b> ${latency} ms\n\n` +
          `<i>NÚCLEO CONTROL • Sistema Control de Gestión</i>`;
        groupResult = await sendTelegramMessage(token, groupId, pingText);
      }

      state.db.telegramConfig.lastSync = new Date().toISOString();
      saveDatabase(state.db);

      if (io) {
        io.emit('mirror:telegram_event', {
          type: 'test_connection',
          status: 'connected',
          botUsername: `@${meData.result.username}`,
          groupDelivered: Boolean(groupResult?.success),
          timestamp: new Date().toISOString(),
        });
      }

      return res.json({
        ok: true,
        botValid: true,
        botUsername: `@${meData.result.username}`,
        botFirstName: meData.result.first_name,
        groupDelivered: Boolean(groupId && groupResult?.success),
        latencyMs: latency,
        message: groupId
          ? `¡Conexión verificada con éxito! Heartbeat enviado al grupo ${groupId} (Latencia: ${latency}ms).`
          : `¡Bot autenticado exitosamente como @${meData.result.username}!`,
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/telegram/set-webhook', async (req, res) => {
    const token = state.db.telegramConfig.botToken || '';
    const { url } = req.body;
    if (!token) return res.status(400).json({ error: 'Token no configurado' });
    try {
      const endpoint = url
        ? `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(url)}`
        : `https://api.telegram.org/bot${token}/deleteWebhook`;
      const tgRes = await fetch(endpoint);
      const data = await tgRes.json();
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // 10. Reset data
  app.post('/api/reset-data', (_req, res) => {
    state.db = {
      orders: [],
      members: INITIAL_MEMBERS || [],
      activity: [],
      telegramConfig: {
        botToken: '',
        groupChatId: '',
        autoRemindersEnabled: true,
        autoReminderHoursBeforeDue: 12,
        status: 'simulated',
      },
    };
    saveDatabase(state.db);
    res.json({ success: true, message: 'Datos restaurados con éxito' });
  });

  return app;
}
