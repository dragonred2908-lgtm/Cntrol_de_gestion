export type OrderStatus = 'recibida' | 'en_cuenta' | 'en_proceso' | 'finalizada';
export type OrderPriority = 'baja' | 'media' | 'alta' | 'urgente';
export type OrderOrigin = 'telegram' | 'web';

export interface OrderNote {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  telegramUser: string;
  telegramChatId?: string | number;
  role: string;
  email: string;
  status: 'activo' | 'ausente' | 'inactivo';
  avatar?: string;
  color?: string;
}

export interface Order {
  id: string;
  title: string;
  description: string;
  origin: OrderOrigin;
  status: OrderStatus;
  priority: OrderPriority;
  assignedTo: Member | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  completedAt?: string;
  department?: string;
  telegramMessageId?: number;
  telegramChatId?: string | number;
  notes?: OrderNote[];
  remindersCount: number;
  lastReminderAt?: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  orderId?: string;
  orderTitle?: string;
  details: string;
  type: 'order_created' | 'status_change' | 'assigned' | 'reminder_sent' | 'telegram_sync' | 'security' | 'member';
}

export interface TelegramConfig {
  botToken: string;
  botUsername?: string;
  botFirstName?: string;
  groupChatId: string;
  groupTitle?: string;
  webhookUrl?: string;
  autoRemindersEnabled: boolean;
  autoReminderHoursBeforeDue: number;
  status: 'connected' | 'unconfigured' | 'error' | 'simulated';
  lastSync?: string;
  errorMessage?: string;
}

export type UserRole = 'admin' | 'developer' | 'operator' | 'viewer';
export type DeviceViewMode = 'pc' | 'mobile';

export interface UserSession {
  role: UserRole;
  name: string;
  authenticated: boolean;
  operatorTelegramUser?: string;
}

export interface MirrorDevice {
  id: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  name: string;
  role: UserRole;
  connectedAt: string;
}

export interface MirrorSyncState {
  isConnected: boolean;
  deviceCount: number;
  lastSyncAt: string | null;
  transport: 'websocket' | 'polling' | 'disconnected';
  latencyMs?: number;
}

export interface ProfessionalStats {
  member: Member;
  totalOrders: number;
  completedOrders: number;
  inProgressOrders: number;
  enCuentaOrders: number;
  pendingOrders: number;
  completionRate: number;
  avgCompletionHours: number;
  overdueOrders: number;
}
