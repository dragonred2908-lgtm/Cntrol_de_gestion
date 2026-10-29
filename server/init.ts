import path from 'path';
import fs from 'fs';
import { Server as SocketIOServer } from 'socket.io';
import { Order, Member, ActivityLog, TelegramConfig } from '../src/types.js';
import { DualPersistenceManager } from './dualPersistence.js';
import { TelegramController } from './telegramController.js';
import { sseManager } from './sseManager.js';
import { config } from './config.js';

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Initial seed members
export const INITIAL_MEMBERS: Member[] = [
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

export const INITIAL_ORDERS: Order[] = [];
export const INITIAL_ACTIVITY: ActivityLog[] = [];

export interface DatabaseSchema {
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
    botToken: config.telegramBotToken || '',
    groupChatId: config.telegramGroupChatId || '-1002692322280',
    autoRemindersEnabled: true,
    autoReminderHoursBeforeDue: 12,
    status: config.telegramBotToken ? 'connected' : 'simulated',
    botUsername: '@nucleo_control_bot',
    botFirstName: 'Control de Gestion',
  },
};

export const dualPersistence = new DualPersistenceManager(DB_FILE, initialDatabase);

export const state: { db: DatabaseSchema } = {
  db: dualPersistence.getData() as DatabaseSchema,
};

export function saveDatabase(data: DatabaseSchema) {
  dualPersistence.saveLocal(data);
  state.db = data;
}

// Telegram controller
export const telegramController = new TelegramController(state.db, saveDatabase);

// Connected mirror devices
export interface ConnectedClient {
  id: string;
  role: string;
  name: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  connectedAt: string;
}

export const connectedDevices = new Map<string, ConnectedClient>();

export function broadcastPresence(io?: SocketIOServer) {
  const devices = Array.from(connectedDevices.values());
  if (io && typeof io.emit === 'function') {
    io.emit('mirror:presence', {
      count: Math.max(1, devices.length),
      devices,
    });
  }
}

export { sseManager };
