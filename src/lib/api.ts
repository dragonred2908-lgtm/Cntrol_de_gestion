import { ActivityLog, Member, Order, OrderStatus, TelegramConfig, UserRole } from '../types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const TOKEN_KEY = 'nucleo_token_v1';
const SESSION_KEY = 'nucleo_session_v2';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}

function clearSession(): void {
  setToken(null);
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new ApiError('No se pudo contactar al servidor. Revisá tu conexión.', 0);
  }

  // Token vencido o revocado: se limpia la sesión local y se vuelve al login.
  if (response.status === 401 && token) {
    clearSession();
    if (!sessionStorage.getItem('nucleo_relogin')) {
      sessionStorage.setItem('nucleo_relogin', '1');
      window.location.reload();
    }
    throw new ApiError('Tu sesión expiró. Iniciá sesión nuevamente.', 401);
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message =
      (body && (body.error || body.message)) ||
      `El servidor respondió con un error (${response.status}).`;
    throw new ApiError(message, response.status);
  }

  return body as T;
}

export interface CreateOrderInput {
  title: string;
  description: string;
  priority: Order['priority'];
  assignedToId?: string;
  dueDate: string;
  department?: string;
  notifyTelegram?: boolean;
}

export interface CreateMemberInput {
  name: string;
  telegramUser: string;
  role: string;
  email?: string;
  telegramChatId?: string;
  status?: Member['status'];
}

export interface TelegramConfigResponse extends TelegramConfig {
  tokenMasked?: string;
  hasToken?: boolean;
}

export interface TelegramTestResult {
  ok: boolean;
  botValid?: boolean;
  botUsername?: string;
  botFirstName?: string;
  groupDelivered?: boolean;
  latencyMs?: number;
  message?: string;
  error?: string;
}

export interface MemberSyncResult {
  ok: true;
  created: number;
  updated: number;
  unchanged: number;
  createdNames: string[];
  total: number;
  groupCount?: number;
}

export interface KpiAnalysis {
  executiveSummary?: string;
  healthScore?: number;
  riskLevel?: string;
  strengths?: string[];
  risks?: string[];
  recommendations?: string[];
  predictedTrend?: string;
  [key: string]: unknown;
}

export const api = {
  orders: {
    list: () => request<Order[]>('/api/orders'),
    create: (input: CreateOrderInput) =>
      request<Order>('/api/orders', { method: 'POST', body: JSON.stringify(input) }),
    setStatus: (orderId: string, status: OrderStatus, noteAuthor: string, noteText?: string) =>
      request<Order>(`/api/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, noteAuthor, noteText, notifyTelegram: true }),
      }),
    addNote: (orderId: string, text: string, author: string) =>
      request<{ id: string; author: string; text: string; createdAt: string }>(
        `/api/orders/${encodeURIComponent(orderId)}/notes`,
        { method: 'POST', body: JSON.stringify({ text, author }) },
      ),
    remove: (orderId: string) =>
      request<{ success: boolean }>(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'DELETE',
      }),
  },

  members: {
    list: () => request<Member[]>('/api/members'),
    create: (input: CreateMemberInput) =>
      request<Member>('/api/members', { method: 'POST', body: JSON.stringify(input) }),
  },

  activity: {
    list: (limit = 100) => request<ActivityLog[]>(`/api/activity?limit=${limit}`),
  },

  telegram: {
    getConfig: () => request<TelegramConfigResponse>('/api/telegram/config'),
    saveConfig: (input: Partial<TelegramConfig>) =>
      request<TelegramConfigResponse>('/api/telegram/config', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    test: (input?: { botToken?: string; groupChatId?: string }) =>
      request<TelegramTestResult>('/api/telegram/test-connection', {
        method: 'POST',
        body: JSON.stringify(input || {}),
      }),
    setWebhook: (url: string) =>
      request<{ ok?: boolean; description?: string }>('/api/telegram/set-webhook', {
        method: 'POST',
        body: JSON.stringify({ url }),
      }),
    syncMembers: (actor?: string) =>
      request<MemberSyncResult>('/api/telegram/sync-members', {
        method: 'POST',
        body: JSON.stringify({ actor }),
      }),
    sendReminder: (input: {
      orderId?: string;
      targetType?: 'all_pending';
      customMessage?: string;
      memberId?: string;
    }) =>
      request<{ success: boolean; sentCount: number }>('/api/telegram/send-reminder', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    broadcast: (input: { title?: string; message: string; priority?: 'normal' | 'urgente' }) =>
      request<{ success: boolean; response?: { success?: boolean; error?: string } }>(
        '/api/telegram/broadcast',
        { method: 'POST', body: JSON.stringify(input) },
      ),
  },

  ai: {
    analyzeKpis: (customGoals?: string) =>
      request<KpiAnalysis>('/api/ai/analyze-kpi', {
        method: 'POST',
        body: JSON.stringify({ customGoals }),
      }),
  },

  auth: {
    verify: (pin: string, role: UserRole) =>
      request<{
        authenticated: boolean;
        role: UserRole;
        name: string;
        token: string;
        expiresIn: number;
        message?: string;
      }>('/api/auth/verify', { method: 'POST', body: JSON.stringify({ pin, role }) }),
    logout: () => setToken(null),
  },

  persistence: {
    status: () => request<Record<string, unknown>>('/api/persistence/status'),
  },

  health: () => request<{ status: string; ordersCount: number; telegramStatus: string; uptime: number }>('/api/health'),

  resetData: () => request<{ success: boolean; message: string }>('/api/reset-data', { method: 'POST' }),

  // Token management
  getToken,
  setToken,
};
