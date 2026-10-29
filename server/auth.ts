import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from './config.js';
import { UserRole } from '../src/types.js';

/**
 * Autenticación de la API basada en tokens firmados (HMAC-SHA256).
 *
 * - No agrega dependencias: usa el módulo `crypto` de Node.
 * - El PIN nunca viaja en cada request: se canjea una vez por un token con
 *   caducidad y ese token es el que firma las llamadas siguientes.
 * - Sin estado: el token se valida con la firma, así que no hace falta sesión
 *   en memoria (compatible con varias instancias si comparten AUTH_SECRET).
 */

export interface AuthClaims {
  /** Nombre visible de la sesión */
  name: string;
  role: UserRole;
  /** Expiración en segundos desde epoch */
  exp: number;
}

export const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 h

function resolveSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  // Derivado estable de secretos ya existentes para no romper sesiones al reiniciar.
  return crypto
    .createHash('sha256')
    .update(`${config.adminPin}:${config.telegramBotToken}:nucleo-control`)
    .digest('hex');
}

const SECRET = resolveSecret();

if (!process.env.AUTH_SECRET) {
  console.warn(
    '[auth] AUTH_SECRET no está definido: se usa una clave derivada. Definilo en producción para rotar sesiones.'
  );
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sign(data: string): string {
  return base64url(crypto.createHmac('sha256', SECRET).update(data).digest());
}

export function createSessionToken(name: string, role: UserRole): string {
  const claims: AuthClaims = {
    name,
    role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const payload = base64url(JSON.stringify(claims));
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): AuthClaims | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8')) as AuthClaims;
    if (!claims?.role || !claims?.name) return null;
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  // EventSource no permite cabeceras personalizadas: aceptamos ?token= en el stream.
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  return queryToken || undefined;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthClaims;
}

/** Exige un token válido. Opcionalmente restringe a ciertos roles. */
export function requireAuth(roles?: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const claims = verifySessionToken(extractToken(req));
    if (!claims) {
      return res.status(401).json({ error: 'Sesión inválida o expirada. Volvé a iniciar sesión.' });
    }
    if (roles && !roles.includes(claims.role)) {
      return res.status(403).json({ error: 'Tu rol no tiene permiso para esta acción.' });
    }
    req.auth = claims;
    next();
  };
}

/** Comprueba el PIN con comparación de tiempo constante. */
export function isValidPin(pin: unknown): boolean {
  if (typeof pin !== 'string' || pin.length === 0) return false;
  const expected = Buffer.from(config.adminPin || '');
  const received = Buffer.from(pin);
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

export const ROLES = {
  /** Puede todo: órdenes, integrantes, configuración y datos. */
  managers: ['admin', 'developer'] as UserRole[],
  /** Puede operar órdenes pero no administrar el sistema. */
  operators: ['admin', 'developer', 'operator'] as UserRole[],
  /** Cualquier sesión válida. */
  any: ['admin', 'developer', 'operator', 'viewer'] as UserRole[],
};
