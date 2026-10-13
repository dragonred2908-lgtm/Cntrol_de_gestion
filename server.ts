import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import { Order, Member, ActivityLog, TelegramConfig, OrderStatus } from './src/types.js';
import {
  TelegramController,
  sendTelegramMessage as tgSendHelper,
  buildOrderTelegramPayload as tgPayloadHelper,
  telegramAuthMiddleware,
} from './server/telegramController.js';
import { sseManager } from './server/sseManager.js';
import { analyzeKpisWithGemini } from './server/kpiAiService.js';
import { DualPersistenceManager, SyncQueueItem } from './server/dualPersistence.js';

dotenv.config();

const app = express();
const PORT = 3000;
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
});

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

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Initial seed members
const INITIAL_MEMBERS: Member[] = [
  {
    id: 'mem-1',
    name: 'Carlos Mendoza',
    telegramUser: '@carlos_mendoza_dev',
    telegramChatId: 108456123,
    role: 'Líder Técnico & Backend',
    email: 'carlos.mendoza@empresa.com',
    status: 'activo',
    color: '#3B82F6',
  },
  {
    id: 'mem-2',
    name: 'Valentina Rios',
    telegramUser: '@valen_frontend',
    telegramChatId: 209845124,
    role: 'Desarrolladora Frontend React',
    email: 'valentina.rios@empresa.com',
    status: 'activo',
    color: '#8B5CF6',
  },
  {
    id: 'mem-3',
    name: 'Mateo Silva',
    telegramUser: '@mateo_qa',
    telegramChatId: 301248756,
    role: 'QA & Control de Calidad',
    email: 'mateo.silva@empresa.com',
    status: 'activo',
    color: '#EC4899',
  },
  {
    id: 'mem-4',
    name: 'Sofia Navas',
    telegramUser: '@sofia_infra',
    telegramChatId: 409871235,
    role: 'DevOps & Cloud Architect',
    email: 'sofia.navas@empresa.com',
    status: 'activo',
    color: '#10B981',
  },
  {
    id: 'mem-5',
    name: 'Diego Herrera',
    telegramUser: '@diego_soporte',
    telegramChatId: 501239841,
    role: 'Soporte & DBA',
    email: 'diego.herrera@empresa.com',
    status: 'activo',
    color: '#F59E0B',
  },
];

// Date helpers
const inHours = (h: number) => new Date(Date.now() + h * 3600 * 1000).toISOString();
const agoHours = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();

// Initial state: Clean database ready for testing (no mock/seed orders)
const INITIAL_ORDERS: Order[] = [];
const INITIAL_ACTIVITY: ActivityLog[] = [];

interface DatabaseSchema {
  orders: Order[];
  members: Member[];
  activity: ActivityLog[];
  telegramConfig: TelegramConfig;
}

const initialDatabase: DatabaseSchema = {
  orders: INITIAL_ORDERS,
  members: INITIAL_MEMBERS,
  activity: INITIAL_ACTIVITY,
  telegramConfig: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '8673349344:AAFx4fkX1_4HALvbil05bRbnj1do_k2rZrg',
    groupChatId: process.env.TELEGRAM_GROUP_CHAT_ID || '-1002692322280',
    autoRemindersEnabled: true,
    autoReminderHoursBeforeDue: 12,
    status: 'connected',
    botUsername: '@nucleo_control_bot',
    botFirstName: 'Control de Gestion',
  },
};

// Dual Persistence Manager (Firestore Primary + Local JSON Backup + FIFO Sync)
const dualPersistence = new DualPersistenceManager(DB_FILE, initialDatabase);
let db = dualPersistence.getData();

function saveDatabase(data: DatabaseSchema) {
  dualPersistence.saveLocal(data);
}

// Telegram Controller & Mirror WebSocket Engine
const telegramController = new TelegramController(db, saveDatabase, io);

interface ConnectedClient {
  id: string;
  role: string;
  name: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  connectedAt: string;
}

const connectedDevices = new Map<string, ConnectedClient>();

function broadcastPresence() {
  const devices = Array.from(connectedDevices.values());
  io.emit('mirror:presence', {
    count: Math.max(1, devices.length),
    devices,
  });
}

io.on('connection', (socket) => {
  const query = socket.handshake.query;
  const role = (query.role as string) || 'admin';
  const name = (query.name as string) || 'Consola de Control';
  const deviceType = ((query.deviceType as string) || 'desktop') as 'desktop' | 'mobile' | 'tablet';

  connectedDevices.set(socket.id, {
    id: socket.id,
    role,
    name,
    deviceType,
    connectedAt: new Date().toISOString(),
  });

  broadcastPresence();

  socket.on('mirror:ping', (ack) => {
    if (typeof ack === 'function') ack();
  });

  socket.on('mirror:device_join', (data) => {
    if (connectedDevices.has(socket.id)) {
      const dev = connectedDevices.get(socket.id)!;
      dev.role = data.role || dev.role;
      dev.name = data.name || dev.name;
      dev.deviceType = data.deviceType || dev.deviceType;
      broadcastPresence();
    }
  });

  socket.on('mirror:order_update', (order: Order) => {
    socket.broadcast.emit('mirror:order_updated', order);
  });

  socket.on('mirror:order_create', (order: Order) => {
    socket.broadcast.emit('mirror:order_created', order);
  });

  socket.on('mirror:request_sync', () => {
    socket.emit('mirror:orders_full', db.orders);
  });

  socket.on('disconnect', () => {
    connectedDevices.delete(socket.id);
    broadcastPresence();
  });
});

// Telegram API Helper
async function sendTelegramMessage(chatId: string | number, text: string, replyMarkup?: any) {
  const token = db.telegramConfig.botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return {
      success: false,
      simulated: true,
      message: 'Modo simulado activo (Sin token configurado). Mensaje registrado en historial.',
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
      console.warn('Telegram API warning:', result.description);
      return { success: false, error: result.description };
    }
    return { success: true, messageId: result.result?.message_id };
  } catch (err: any) {
    console.error('Telegram API error:', err);
    return { success: false, error: err.message };
  }
}

// Build standard Telegram message for an order with action buttons
function buildOrderTelegramPayload(order: Order) {
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

  const assignedHandle = order.assignedTo ? `${order.assignedTo.name} (${order.assignedTo.telegramUser})` : 'Sin asignar';

  const text = `📋 <b>ORDEN DE GESTIÓN: #${order.id}</b>\n\n` +
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

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health & Server Status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    ordersCount: db.orders.length,
    telegramStatus: db.telegramConfig.status,
    uptime: process.uptime(),
  });
});

// ----------------------------------------------------
// CANAL SSE (Server-Sent Events) con Heartbeat cada 20s
// ----------------------------------------------------
app.get('/api/realtime/stream', (req, res) => {
  const clientId = `sse-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  sseManager.addClient(clientId, res);

  req.on('close', () => {
    sseManager.removeClient(clientId);
  });
});

// ----------------------------------------------------
// MOTOR DE IA: Análisis de KPIs con @google/genai Gemini
// ----------------------------------------------------
app.post('/api/ai/analyze-kpi', async (req, res) => {
  try {
    const { customGoals } = req.body || {};
    const analysis = await analyzeKpisWithGemini(db.orders, db.members, customGoals);

    // Broadcast update to all live SSE and WebSocket listeners
    sseManager.broadcast('kpi_analysis', analysis);
    io.emit('kpi:update', analysis);

    return res.json(analysis);
  } catch (err: any) {
    console.error('[AI KPI Service] Error en análisis:', err);
    return res.status(500).json({
      error: err.message || 'Error analizando KPIs operacionales con IA',
    });
  }
});

// ----------------------------------------------------
// PERSISTENCIA DUAL: Estado y Cola FIFO de Sincronización
// ----------------------------------------------------
app.get('/api/persistence/status', (req, res) => {
  res.json(dualPersistence.getStatus());
});

app.post('/api/sync/fifo', (req, res) => {
  const items: SyncQueueItem[] = req.body.items || [];
  if (!Array.isArray(items) || items.length === 0) {
    return res.json({ totalReceived: 0, applied: 0, conflictsSkipped: 0, results: [] });
  }

  const result = dualPersistence.processFIFOQueue(items);
  db = dualPersistence.getData();

  // Broadcast sync events to SSE and WebSocket mirrors
  sseManager.broadcast('sync_batch_applied', {
    appliedCount: result.applied,
    conflictsSkipped: result.conflictsSkipped,
    timestamp: new Date().toISOString(),
  });

  io.emit('mirror:bulk_update', {
    orders: db.orders,
    activity: db.activity,
  });

  return res.json({
    success: true,
    ...result,
    persistenceStatus: dualPersistence.getStatus(),
  });
});

// 2. Authentication / Role Verification
app.post('/api/auth/verify', (req, res) => {
  const { pin, role } = req.body;
  const adminPin = process.env.ADMIN_PIN || '123456';

  // If role is viewer, no pin required
  if (role === 'viewer') {
    return res.json({ authenticated: true, role: 'viewer', name: 'Observador' });
  }

  // If pin matches configured pin, 123456 or legacy 1234
  if (pin === adminPin || pin === '123456' || pin === '1234') {
    const roleName = role === 'developer' ? 'Personal de Desarrollo' : 'Administrador de Gestión';
    return res.json({
      authenticated: true,
      role: role || 'admin',
      name: roleName,
    });
  }

  return res.status(401).json({
    authenticated: false,
    message: 'PIN de acceso inválido. El PIN configurado es 123456.',
  });
});

// 3. Orders Management
app.get('/api/orders', (req, res) => {
  const { status, priority, professionalId, search } = req.query;
  let filtered = [...db.orders];

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

  // Sort by updatedAt descending
  filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  res.json(filtered);
});

// Create Order (Admin or via API)
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

  const assignedMember = db.members.find((m) => m.id === assignedToId) || null;

  // Generate unique order ID
  const nextNum = 1000 + db.orders.length + 1;
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
    dueDate: dueDate || inHours(48),
    department: department || 'General',
    remindersCount: 0,
    notes: [],
  };

  db.orders.unshift(newOrder);

  // Log activity
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
  db.activity.unshift(log);

  // Send to Telegram if requested
  let telegramSent = false;
  if (notifyTelegram) {
    const targetChat = assignedMember?.telegramChatId || db.telegramConfig.groupChatId;
    if (targetChat) {
      const payload = buildOrderTelegramPayload(newOrder);
      const tgRes = await sendTelegramMessage(targetChat, payload.text, payload.reply_markup);
      telegramSent = tgRes.success;
      if (tgRes.messageId) {
        newOrder.telegramMessageId = tgRes.messageId;
      }
    }
  }

  saveDatabase(db);

  // ⚡ Mirror Sync: Emit to all connected PCs and mobile devices instantly
  io.emit('mirror:order_created', newOrder);
  io.emit('mirror:activity_logged', log);
  sseManager.broadcast('order_created', newOrder);
  sseManager.broadcast('activity_logged', log);

  res.status(201).json({ order: newOrder, telegramNotified: telegramSent });
});

// Update Order Status / Details
app.patch('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { status, priority, assignedToId, noteText, noteAuthor, notifyTelegram = true } = req.body;

  const orderIndex = db.orders.findIndex((o) => o.id === id);
  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Orden no encontrada' });
  }

  const order = db.orders[orderIndex];
  const prevStatus = order.status;

  if (status && ['recibida', 'en_cuenta', 'en_proceso', 'finalizada'].includes(status)) {
    order.status = status as OrderStatus;
    if (status === 'finalizada' && !order.completedAt) {
      order.completedAt = new Date().toISOString();
    }
  }

  if (priority) {
    order.priority = priority;
  }

  if (assignedToId !== undefined) {
    order.assignedTo = db.members.find((m) => m.id === assignedToId) || null;
  }

  if (noteText) {
    if (!order.notes) order.notes = [];
    order.notes.push({
      id: `note-${Date.now()}`,
      author: noteAuthor || 'Administrador',
      text: noteText,
      createdAt: new Date().toISOString(),
    });
  }

  order.updatedAt = new Date().toISOString();

  // Log activity
  let statusLog: ActivityLog | null = null;
  if (prevStatus !== order.status) {
    statusLog = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: noteAuthor || 'Panel de Gestión',
      action: 'Actualización de Estado',
      orderId: order.id,
      orderTitle: order.title,
      details: `Estado cambiado de "${prevStatus}" a "${order.status}".`,
      type: 'status_change',
    };
    db.activity.unshift(statusLog);
  }

  // Notify telegram of status change
  if (notifyTelegram && prevStatus !== order.status) {
    const targetChat = order.assignedTo?.telegramChatId || db.telegramConfig.groupChatId;
    if (targetChat) {
      const statusNames: Record<string, string> = {
        recibida: '📥 RECIBIDA',
        en_cuenta: '👀 EN CUENTA (Tomada en consideración)',
        en_proceso: '⏳ EN PROCESO (En desarrollo activo)',
        finalizada: '✅ FINALIZADA (Completada exitosamente)',
      };
      const text = `🔄 <b>ACTUALIZACIÓN DE ORDEN #${order.id}</b>\n\n` +
        `<b>Título:</b> ${order.title}\n` +
        `<b>Nuevo Estado:</b> <b>${statusNames[order.status]}</b>\n` +
        `<b>Responsable:</b> ${order.assignedTo ? order.assignedTo.name : 'Sin asignar'}\n` +
        `<b>Actualizado por:</b> ${noteAuthor || 'Panel de Control'}\n` +
        (noteText ? `\n💬 <i>Nota: ${noteText}</i>` : '');

      await sendTelegramMessage(targetChat, text);
    }
  }

  saveDatabase(db);

  // ⚡ Mirror Sync: Instant reflection on desktop and mobile
  io.emit('mirror:order_updated', order);
  sseManager.broadcast('order_updated', order);
  if (statusLog) {
    io.emit('mirror:activity_logged', statusLog);
    sseManager.broadcast('activity_logged', statusLog);
  }

  res.json(order);
});

// Delete Order
app.delete('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const initialLen = db.orders.length;
  db.orders = db.orders.filter((o) => o.id !== id);

  if (db.orders.length < initialLen) {
    const delLog: ActivityLog = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: 'Administrador',
      action: 'Eliminación de Orden',
      orderId: id,
      details: `La orden #${id} fue eliminada del sistema.`,
      type: 'order_created',
    };
    db.activity.unshift(delLog);
    saveDatabase(db);

    // ⚡ Mirror Sync
    io.emit('mirror:order_deleted', { id });
    io.emit('mirror:activity_logged', delLog);
    sseManager.broadcast('order_deleted', { id });
    sseManager.broadcast('activity_logged', delLog);

    return res.json({ success: true });
  }
  return res.status(404).json({ error: 'Orden no encontrada' });
});

// 4. Members / Professionals
app.get('/api/members', (req, res) => {
  res.json(db.members);
});

app.post('/api/members', (req, res) => {
  const { name, telegramUser, role, email, status = 'activo', telegramChatId } = req.body;
  if (!name || !telegramUser) {
    return res.status(400).json({ error: 'Nombre y usuario de Telegram son requeridos' });
  }

  const newMember: Member = {
    id: `mem-${Date.now()}`,
    name,
    telegramUser: telegramUser.startsWith('@') ? telegramUser : `@${telegramUser}`,
    telegramChatId: telegramChatId ? Number(telegramChatId) : undefined,
    role: role || 'Especialista',
    email: email || `${telegramUser.replace('@', '')}@empresa.com`,
    status,
    color: ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#6366F1'][
      db.members.length % 6
    ],
  };

  db.members.push(newMember);
  db.activity.unshift({
    id: `act-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: 'Administrador',
    action: 'Nuevo Integrante Registrado',
    details: `${newMember.name} (${newMember.telegramUser}) añadido como ${newMember.role}.`,
    type: 'member',
  });

  saveDatabase(db);
  res.status(201).json(newMember);
});

// 5. Activity Logs
app.get('/api/activity', (req, res) => {
  const limit = Number(req.query.limit) || 100;
  res.json(db.activity.slice(0, limit));
});

// 6. Telegram Reminders & Push Broadcast
app.post('/api/telegram/send-reminder', async (req, res) => {
  const { orderId, targetType, customMessage, memberId } = req.body;
  // targetType: 'group' | 'individual' | 'all_pending'

  let sentCount = 0;
  const logs: string[] = [];

  if (targetType === 'all_pending') {
    // Send automated reminder for all pending/in-progress orders
    const pendingOrders = db.orders.filter((o) => o.status !== 'finalizada');
    for (const order of pendingOrders) {
      const targetChat = order.assignedTo?.telegramChatId || db.telegramConfig.groupChatId;
      if (targetChat) {
        order.remindersCount = (order.remindersCount || 0) + 1;
        order.lastReminderAt = new Date().toISOString();

        const reminderMsg = `🔔 <b>RECORDATORIO AUTOMÁTICO DE TAREA PENDIENTE</b>\n\n` +
          `<b>Orden:</b> #${order.id} - ${order.title}\n` +
          `<b>Estado:</b> ${order.status.toUpperCase()}\n` +
          `<b>Asignado a:</b> ${order.assignedTo ? order.assignedTo.name : 'Sin Asignar'}\n` +
          `<b>Fecha Límite:</b> ⏰ ${new Date(order.dueDate).toLocaleString('es-ES')}\n` +
          (customMessage ? `\n📌 <i>Mensaje del Administrador:</i>\n${customMessage}\n` : '') +
          `\nPor favor actualicen su avance utilizando los botones o respondiendo con el estado.`;

        const payload = buildOrderTelegramPayload(order);
        await sendTelegramMessage(targetChat, reminderMsg, payload.reply_markup);
        sentCount++;
      }
    }

    db.activity.unshift({
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: 'Administrador (Panel)',
      action: 'Recordatorio Masivo Telegram',
      details: `Se emitieron ${sentCount} recordatorios automáticos de órdenes pendientes al grupo/integrantes.`,
      type: 'reminder_sent',
    });
  } else if (orderId) {
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const member = memberId ? db.members.find((m) => m.id === memberId) : order.assignedTo;
    const targetChat = member?.telegramChatId || db.telegramConfig.groupChatId;

    order.remindersCount = (order.remindersCount || 0) + 1;
    order.lastReminderAt = new Date().toISOString();

    const text = `🔔 <b>RECORDATORIO PERSONALIZADO DE ORDEN #${order.id}</b>\n\n` +
      `Estimado(a) <b>${member ? member.name : 'Equipo'}</b> (${member ? member.telegramUser : '@todos'}):\n` +
      `Le recordamos el seguimiento de la orden:\n` +
      `<b>Título:</b> ${order.title}\n` +
      `<b>Prioridad:</b> ${order.priority.toUpperCase()}\n` +
      `<b>Estado:</b> ${order.status.toUpperCase()}\n` +
      `<b>Fecha Límite:</b> ⏰ ${new Date(order.dueDate).toLocaleString('es-ES')}\n\n` +
      (customMessage ? `📌 <b>Nota del Administrador:</b>\n<i>${customMessage}</i>\n\n` : '') +
      `Por favor seleccione su estado actualizado:`;

    const payload = buildOrderTelegramPayload(order);
    const tgRes = await sendTelegramMessage(targetChat, text, payload.reply_markup);

    db.activity.unshift({
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: 'Administrador (Panel)',
      action: 'Recordatorio Personalizado',
      orderId: order.id,
      orderTitle: order.title,
      details: `Recordatorio enviado a ${member ? member.name : 'Grupo General'} (${member ? member.telegramUser : 'Grupo'}).`,
      type: 'reminder_sent',
    });

    sentCount = 1;
  }

  saveDatabase(db);
  res.json({ success: true, sentCount, logs });
});

// Broadcast general push notification to group
app.post('/api/telegram/broadcast', async (req, res) => {
  const { title, message, priority = 'normal', targetGroup = true } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'El mensaje es obligatorio' });
  }

  const priorityHeader = priority === 'urgente' ? '🚨 COMUNICADO URGENTE' : '📢 AVISO GENERAL DE GESTIÓN';
  const text = `<b>${priorityHeader}</b>\n` +
    (title ? `<b>${title}</b>\n\n` : '\n') +
    `${message}\n\n` +
    `<i>Emitido por Dirección de Control de Gestión</i>`;

  const targetChat = db.telegramConfig.groupChatId || '@grupo_control_gestion';
  const tgRes = await sendTelegramMessage(targetChat, text);

  db.activity.unshift({
    id: `act-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: 'Administrador',
    action: 'Notificación Push General',
    details: `Comunicado enviado a Telegram: "${title || message.substring(0, 40)}"`,
    type: 'telegram_sync',
  });

  saveDatabase(db);
  res.json({ success: true, response: tgRes });
});

// 7. Telegram Configuration & Connection Testing
app.get('/api/telegram/config', (req, res) => {
  // Hide secret token partially for security
  const safeToken = db.telegramConfig.botToken
    ? `${db.telegramConfig.botToken.substring(0, 6)}...${db.telegramConfig.botToken.slice(-4)}`
    : '';

  res.json({
    ...db.telegramConfig,
    tokenMasked: safeToken,
    hasToken: Boolean(db.telegramConfig.botToken),
  });
});

app.post('/api/telegram/config', async (req, res) => {
  const { botToken, groupChatId, autoRemindersEnabled, autoReminderHoursBeforeDue } = req.body;

  if (botToken !== undefined && botToken !== '') {
    db.telegramConfig.botToken = botToken;
  }
  if (groupChatId !== undefined) {
    db.telegramConfig.groupChatId = groupChatId;
  }
  if (autoRemindersEnabled !== undefined) {
    db.telegramConfig.autoRemindersEnabled = Boolean(autoRemindersEnabled);
  }
  if (autoReminderHoursBeforeDue !== undefined) {
    db.telegramConfig.autoReminderHoursBeforeDue = Number(autoReminderHoursBeforeDue);
  }

  // Test token if provided
  if (db.telegramConfig.botToken) {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${db.telegramConfig.botToken}/getMe`);
      const data = (await resp.json()) as any;
      if (data.ok) {
        db.telegramConfig.status = 'connected';
        db.telegramConfig.botUsername = `@${data.result.username}`;
        db.telegramConfig.botFirstName = data.result.first_name;
        db.telegramConfig.errorMessage = undefined;
      } else {
        db.telegramConfig.status = 'error';
        db.telegramConfig.errorMessage = data.description;
      }
    } catch (e: any) {
      db.telegramConfig.status = 'error';
      db.telegramConfig.errorMessage = e.message;
    }
  } else {
    db.telegramConfig.status = 'simulated';
  }

  db.telegramConfig.lastSync = new Date().toISOString();
  saveDatabase(db);

  res.json(db.telegramConfig);
});

// ----------------------------------------------------
// TELEGRAM CORE UPDATE HANDLER (Shared by Webhook & Poller)
// ----------------------------------------------------
async function handleTelegramUpdate(update: any) {
  if (!update) return { ok: false, error: 'Empty update' };

  // 1. Handle Callback Query (Inline Keyboard Buttons [En Cuenta], [En Proceso], [Finalizada])
  if (update.callback_query) {
    const cq = update.callback_query;
    const data = cq.data || ''; // e.g. "status:ORD-1001:en_proceso"
    const fromUser = cq.from?.username ? `@${cq.from.username}` : cq.from?.first_name || 'Usuario Telegram';
    const chatId = cq.message?.chat?.id;

    if (data.startsWith('status:')) {
      const parts = data.split(':');
      const orderId = parts[1];
      const newStatus = parts[2] as OrderStatus;

      const order = db.orders.find((o) => o.id === orderId);
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
          details: `El integrante ${fromUser} cambió el estado de la orden #${order.id} a "${statusNames[newStatus] || newStatus}".`,
          type: 'status_change',
        };
        db.activity.unshift(log);
        saveDatabase(db);

        // Answer callback query via Telegram API
        const token = db.telegramConfig.botToken || process.env.TELEGRAM_BOT_TOKEN;
        if (token && cq.id) {
          try {
            await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                callback_query_id: cq.id,
                text: `✅ Estado de orden #${order.id} actualizado a: ${statusNames[newStatus] || newStatus}`,
                show_alert: false,
              }),
            });
          } catch (e) {
            console.error('Error answering callback query:', e);
          }
        }

        // Notify chat of the successful status change
        if (chatId) {
          const updateAlert = `⚡ <b>ESTADO ACTUALIZADO</b>\n` +
            `El integrante <b>${fromUser}</b> actualizó la orden <b>#${order.id}</b>\n` +
            `<b>Título:</b> ${order.title}\n` +
            `<b>Nuevo Estado:</b> <b>${statusNames[newStatus] || newStatus}</b>`;
          await sendTelegramMessage(chatId, updateAlert);
        }

        return { ok: true, status: 'updated', orderId, newStatus };
      }
    }
  }

  // 2. Handle Messages & Commands
  if (update.message && update.message.text) {
    const msg = update.message;
    const text = msg.text.trim();
    const fromUser = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || 'Usuario Telegram';
    const chatId = msg.chat.id;

    // Command: /start or /ayuda
    if (text === '/start' || text.startsWith('/ayuda') || text.startsWith('/help')) {
      const helpText = `🤖 <b>Bot de Control de Gestión Operativo</b>\n\n` +
        `Este bot recibe órdenes de trabajo, recordatorios automáticos de fechas límite y sincroniza el estado de tareas con el panel web central.\n\n` +
        `<b>Comandos principales:</b>\n` +
        `• <code>/nuevaorden [Título] | [Descripción] | [Prioridad: baja/media/alta/urgente] | [@usuario]</code>\n` +
        `• <code>/ordenes</code> - Listar órdenes activas\n` +
        `• <code>/estado [ID_ORDEN] [en_cuenta|en_proceso|finalizada]</code>\n` +
        `• <code>/ayuda</code> - Ver instrucciones\n\n` +
        `👇 <i>Cada orden asignada incluye botones interactivos [En Cuenta], [En Proceso] y [Finalizada].</i>`;

      await sendTelegramMessage(chatId, helpText);
      return { ok: true, command: 'help' };
    }

    // Command: /ordenes
    if (text.startsWith('/ordenes')) {
      const pending = db.orders.filter((o) => o.status !== 'finalizada').slice(0, 8);
      if (pending.length === 0) {
        await sendTelegramMessage(chatId, '✅ ¡No hay órdenes pendientes en este momento! Todas están finalizadas.');
      } else {
        let msgList = `📋 <b>Órdenes Activas Pendientes (${pending.length}):</b>\n\n`;
        pending.forEach((o) => {
          const prio = o.priority.toUpperCase();
          const assigned = o.assignedTo ? `${o.assignedTo.name} (${o.assignedTo.telegramUser})` : 'Sin asignar';
          const due = new Date(o.dueDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
          msgList += `• <b>#${o.id}</b>: ${o.title}\n  Estado: [${o.status.toUpperCase()}] | Prioridad: ${prio}\n  Asignado: ${assigned} | Límite: ⏰ ${due}\n\n`;
        });
        await sendTelegramMessage(chatId, msgList);
      }
      return { ok: true, command: 'ordenes' };
    }

    // Command: /nuevaorden or starting with orden:
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

      // Find member by username or name
      let assignedMember: Member | null = null;
      if (assignedTarget) {
        assignedMember =
          db.members.find(
            (m) =>
              m.telegramUser.toLowerCase() === assignedTarget.toLowerCase() ||
              m.name.toLowerCase().includes(assignedTarget.toLowerCase())
          ) || null;
      }

      const nextNum = 1000 + db.orders.length + 1;
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
        dueDate: inHours(48),
        telegramChatId: chatId,
        remindersCount: 0,
        notes: [],
      };

      db.orders.unshift(newOrder);

      const log: ActivityLog = {
        id: `act-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: fromUser,
        action: 'Recepción de Orden por Telegram',
        orderId: newOrder.id,
        orderTitle: newOrder.title,
        details: `Orden recibida desde Telegram por ${fromUser}. Asignada a: ${assignedMember ? assignedMember.name : 'Sin asignar'}.`,
        type: 'order_created',
      };
      db.activity.unshift(log);
      saveDatabase(db);

      // Reply back to chat with confirmation and interactive buttons
      const payload = buildOrderTelegramPayload(newOrder);
      await sendTelegramMessage(chatId, `✅ <b>Orden creada y registrada exitosamente!</b>\n\n${payload.text}`, payload.reply_markup);

      return { ok: true, createdOrder: newOrder };
    }
  }

  return { ok: true, message: 'Update processed' };
}

// 8. Telegram Webhook Endpoint
app.post('/api/telegram/webhook', telegramAuthMiddleware(), async (req, res) => {
  const update = req.body;
  console.log('Incoming Telegram Webhook Update:', JSON.stringify(update));
  const result = await telegramController.handleUpdate(update);
  return res.json(result);
});

// Test Connection with Telegram Bot API & Group (Heartbeat Verification)
app.post('/api/telegram/test-connection', async (req, res) => {
  const token = (req.body?.botToken && String(req.body.botToken).trim()) || db.telegramConfig.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const groupId = (req.body?.groupChatId && String(req.body.groupChatId).trim()) || db.telegramConfig.groupChatId || process.env.TELEGRAM_GROUP_CHAT_ID;

  if (!token) {
    return res.status(400).json({
      ok: false,
      botValid: false,
      error: 'No hay token de Telegram configurado.',
      hint: 'Ingresa el Bot Token que te otorgó @BotFather en el campo "Telegram Bot Token" a continuación y haz clic en "Test Connection" o "Guardar Configuración".',
    });
  }

  const startTime = Date.now();
  try {
    // 1. Verify bot info
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = (await meRes.json()) as any;
    if (!meData.ok) {
      return res.status(400).json({ ok: false, error: meData.description || 'Token de Telegram inválido' });
    }

    db.telegramConfig.status = 'connected';
    db.telegramConfig.botUsername = `@${meData.result.username}`;
    db.telegramConfig.botFirstName = meData.result.first_name;
    if (req.body?.botToken) db.telegramConfig.botToken = String(req.body.botToken).trim();
    if (req.body?.groupChatId) db.telegramConfig.groupChatId = String(req.body.groupChatId).trim();

    // 2. Verify group if provided - SEND HEARTBEAT MESSAGE IMMEDIATELY
    let groupResult: any = null;
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const latency = Date.now() - startTime;

    if (groupId) {
      const pingText = `💓 <b>[HEARTBEAT] Verificación de Conectividad Telegram API</b>\n\n` +
        `🤖 <b>Bot:</b> @${meData.result.username} (${meData.result.first_name || 'Bot'})\n` +
        `⏱ <b>Timestamp:</b> ${nowIso} UTC\n` +
        `📡 <b>Estado de Red:</b> ONLINE (Conectividad bidireccional confirmada)\n` +
        `🎯 <b>Grupo Destino:</b> <code>${groupId}</code>\n` +
        `⚡ <b>Latencia API:</b> ${latency} ms\n\n` +
        `<i>NÚCLEO CONTROL • Sistema Control de Gestión</i>`;

      groupResult = await sendTelegramMessage(groupId, pingText);
    }

    db.telegramConfig.lastSync = new Date().toISOString();
    saveDatabase(db);

    // Notify connected mirror devices via Socket.io
    io.emit('mirror:telegram_event', {
      type: 'test_connection',
      status: 'connected',
      botUsername: `@${meData.result.username}`,
      groupDelivered: Boolean(groupResult?.success),
      timestamp: new Date().toISOString(),
    });

    if (groupId && !groupResult?.success) {
      return res.json({
        ok: true,
        botValid: true,
        botUsername: `@${meData.result.username}`,
        botFirstName: meData.result.first_name,
        groupDelivered: false,
        groupError: groupResult?.error || 'Error al enviar al grupo',
        latencyMs: latency,
        hint: `El bot @${meData.result.username} está autenticado correctamente ante Telegram API, pero para recibir mensajes en el grupo (${groupId}) debes entrar a Telegram en tu móvil/PC, ingresar a los ajustes del grupo, añadir a @${meData.result.username} y darle permisos de Administrador o Miembro.`,
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
        ? `¡Conexión verificada con éxito! Mensaje Heartbeat enviado de inmediato al grupo ${groupId} (Latencia: ${latency}ms).`
        : `¡Bot autenticado exitosamente como @${meData.result.username}! Configura el ID del grupo para recibir el Heartbeat.`,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Set Webhook Endpoint URL
app.post('/api/telegram/set-webhook', async (req, res) => {
  const token = db.telegramConfig.botToken || process.env.TELEGRAM_BOT_TOKEN;
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

// 9. Reset Demo Data
app.post('/api/reset-data', (req, res) => {
  db = {
    orders: INITIAL_ORDERS,
    members: INITIAL_MEMBERS,
    activity: INITIAL_ACTIVITY,
    telegramConfig: {
      botToken: '8673349344:AAFx4fkX1_4HALvbil05bRbnj1do_k2rZrg',
      groupChatId: '-1002692322280',
      autoRemindersEnabled: true,
      autoReminderHoursBeforeDue: 12,
      status: 'connected',
      botUsername: '@nucleo_control_bot',
      botFirstName: 'Control de Gestion',
    },
  };
  saveDatabase(db);
  res.json({ success: true, message: 'Datos restaurados con éxito' });
});

// ----------------------------------------------------
// BACKGROUND TELEGRAM LONG-POLLER
// ----------------------------------------------------
let pollerRunning = false;
let lastUpdateId = 0;

async function startTelegramPoller() {
  if (pollerRunning) return;
  pollerRunning = true;

  console.log('🤖 Iniciando Poller en Vivo de Telegram Bot API...');

  const pollLoop = async () => {
    while (pollerRunning) {
      const token = db.telegramConfig.botToken || process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      try {
        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=15`;
        const resp = await fetch(url);
        if (!resp.ok) {
          // If webhook is active (status 409), pause briefly
          await new Promise((r) => setTimeout(r, 6000));
          continue;
        }

        const data = (await resp.json()) as any;
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            lastUpdateId = Math.max(lastUpdateId, update.update_id);
            try {
              await telegramController.handleUpdate(update);
            } catch (err) {
              console.error('Error handling polled update:', err);
            }
          }
        }
      } catch (err) {
        // Transient network error, wait before retry
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
  };

  pollLoop();
}

// ----------------------------------------------------
// VITE DEV MIDDLEWARE / STATIC PRODUCTION SERVING
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Control de Gestión Server & Socket.io running at http://0.0.0.0:${PORT}`);
    // Start background Telegram poller
    startTelegramPoller();
  });
}

startServer();
