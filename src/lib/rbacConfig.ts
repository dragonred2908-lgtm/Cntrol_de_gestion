import { UserRole } from '../types';

export type Permission =
  | 'view_dashboard'
  | 'manage_orders'        // Create, edit, change status
  | 'create_orders'
  | 'export_reports'       // PDF, Excel
  | 'view_professionals'
  | 'send_reminders'
  | 'view_activity_logs'
  | 'access_dev_tools'     // System console, webhook debug, simulation
  | 'configure_telegram'   // Bot tokens, group IDs
  | 'sync_members'         // Barrido de integrantes del grupo de Telegram
  | 'reset_database'
  | 'web_access';          // Allowed to enter main web UI

export interface RolePermissions {
  role: UserRole;
  title: string;
  description: string;
  permissions: Permission[];
  exclusiveFeatures?: string[];
}

export const RBAC_MATRIX: Record<UserRole, RolePermissions> = {
  developer: {
    role: 'developer',
    title: 'Desarrollador (Ing. de Software)',
    description: 'Acceso total a la UI, consola de desarrollo, diagnóstico de Webhooks y configuración técnica.',
    permissions: [
      'web_access',
      'view_dashboard',
      'manage_orders',
      'create_orders',
      'export_reports',
      'view_professionals',
      'send_reminders',
      'view_activity_logs',
      'access_dev_tools',
      'configure_telegram',
      'sync_members',
      'reset_database',
    ],
    exclusiveFeatures: [
      'Consola de desarrollo y telemetría de WebSockets',
      'Simulador interactivo de Telegram con terminal de depuración',
      'Configuración avanzada de Webhooks y token de Bot',
      'Herramientas de inspección de estado del servidor en vivo',
    ],
  },
  admin: {
    role: 'admin',
    title: 'Administrador Principal (Francisco)',
    description: 'Gestión ejecutiva completa: asignación de órdenes, seguimiento en tiempo real y emisión de reportes.',
    permissions: [
      'web_access',
      'view_dashboard',
      'manage_orders',
      'create_orders',
      'export_reports',
      'view_professionals',
      'send_reminders',
      'view_activity_logs',
      'sync_members',
    ],
    exclusiveFeatures: [
      'Asignación ejecutiva de órdenes con aviso push a Telegram',
      'Exportación certificada en PDF corporativo y hojas Excel',
      'Despacho de recordatorios manuales y masivos a integrantes',
      'Monitoreo del desempeño y efectividad de profesionales',
    ],
  },
  operator: {
    role: 'operator',
    title: 'Operador de Campo / Integrante',
    description: 'Interacción exclusiva mediante el Bot y Grupo de Telegram. Sin acceso a la interfaz web corporativa.',
    permissions: [], // Operadores NO tienen 'web_access'
    exclusiveFeatures: [
      'Recepción de órdenes asignadas por Telegram con botones de acción rápida',
      'Confirmación [📥 En Cuenta], [⏳ En Proceso] y [✅ Finalizada] desde Telegram',
      'Consultas directas mediante comandos /ordenes y /ayuda en el chat',
    ],
  },
  viewer: {
    role: 'viewer',
    title: 'Observador (Solo Lectura)',
    description: 'Visualización de dashboard y métricas sin permisos de modificación ni asignación.',
    permissions: [
      'web_access',
      'view_dashboard',
      'view_professionals',
    ],
  },
};

/**
 * Verifica si un rol posee un permiso específico
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const roleConfig = RBAC_MATRIX[role];
  if (!roleConfig) return false;
  return roleConfig.permissions.includes(permission);
}

/**
 * Verifica si el usuario tiene autorización para acceder a la aplicación web
 */
export function canAccessWebUI(role: UserRole): boolean {
  return hasPermission(role, 'web_access');
}
