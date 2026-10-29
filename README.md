# NÚCLEO CONTROL — Control de Gestión

Aplicación de gestión de órdenes de trabajo para equipos pequeños: un tablero único, trazabilidad de cada cambio y avisos al grupo de Telegram. Un solo proceso Node sirve la interfaz y la API.

## Características

- **Órdenes** con ciclo de vida fijo (`recibida → en_cuenta → en_proceso → finalizada`) y prioridad (`baja`, `media`, `alta`, `urgente`).
- **Tablero kanban** y vista de lista, responsive: barra lateral en escritorio, menú desplegable en móvil.
- **Tiempo real** con Socket.IO y SSE (`/api/realtime/stream`); si se cae la red, los cambios quedan en cola FIFO y se sincronizan al volver.
- **Telegram**: creación de órdenes por comando, botones inline de cambio de estado, recordatorios y comunicados.
- **Equipo y carga**: integrantes, roles y reparto de trabajo.
- **Reportes** con análisis de KPIs asistido por IA y **auditoría** de cambios.
- **Persistencia** en JSON gestionada por `DualPersistenceManager`, con copia y restauración simples.

## Stack

- Frontend: React 19 + Vite + Tailwind CSS v4, iconos `lucide-react`.
- Backend: Express + Socket.IO en `server/`, arranque en `server.ts`.
- Runtime: Node.js 22.

## Requisitos

- Node.js 22 LTS y npm 10+.
- Git.
- Para producción: Linux con systemd + Caddy, o Docker con `docker compose`.

## Inicio rápido

```bash
npm ci
cp .env.example .env     # edita ADMIN_PIN, AUTH_SECRET y Telegram
npm run dev              # http://localhost:3000
```

Entra con el PIN de `ADMIN_PIN`. Detalle en [docs/INSTALACION.md](./docs/INSTALACION.md) y configuración del bot en [docs/GUIA-TELEGRAM.md](./docs/GUIA-TELEGRAM.md).

## Variables de entorno

| Nombre | Obligatoria | Ejemplo | Para qué |
|---|---|---|---|
| `NODE_ENV` | No | `production` | Modo de ejecución; en producción activa el comportamiento de servidor |
| `PORT` | No | `3000` | Puerto HTTP del proceso |
| `APP_URL` | No | `https://control.midominio.com` | URL pública, sin barra final |
| `AUTH_SECRET` | Sí en producción | `openssl rand -hex 32` | Firma HMAC de los tokens de sesión; si falta, se deriva del PIN y avisa |
| `CORS_ORIGINS` | No | `https://control.midominio.com` | Orígenes permitidos, separados por comas |
| `ADMIN_PIN` | Sí | `123456` (por defecto) | PIN de acceso; cámbialo siempre |
| `GEMINI_API_KEY` | No | `""` | Análisis de KPIs con `gemini-3.8-flash` |
| `TELEGRAM_BOT_TOKEN` | No | `123456789:AAH...` | Token del bot de @BotFather |
| `TELEGRAM_GROUP_CHAT_ID` | No | `-1001234567890` | Grupo de destino de avisos |
| `TELEGRAM_ADMIN_IDS` | No | `123456789,@fulano` | Quién puede ejecutar `/actualizar`; coma, ID o `@usuario` |

## Comandos

| Comando | Qué hace |
|---|---|
| `npm ci` | Instala dependencias exactas del lock |
| `npm run dev` | Servidor de desarrollo con Vite middleware en el puerto 3000 |
| `npm run lint` | `tsc --noEmit`; único check estático |
| `npm run build` | `vite build` + bundle del servidor a `dist/server.cjs` |
| `npm start` | Sirve `dist/` (requiere build previo) |
| `npm run clean` | Borra `dist/`; usa `rm -rf` y falla en PowerShell |

## Despliegue

- **systemd + Caddy**: `deploy/nucleo.service` (`User=nucleo`, `WorkingDirectory=/opt/nucleo`, `EnvironmentFile=/opt/nucleo/.env`, `ReadWritePaths=/opt/nucleo/data`, `ExecStart=/usr/bin/node /opt/nucleo/dist/server.cjs`) y `deploy/Caddyfile` (dominio con HTTPS automático, `flush_interval -1` para SSE, proxy a `127.0.0.1:3000`).
- **Docker**: `Dockerfile` sobre `node:22-alpine` con healthcheck y `docker-compose.yml` con el puerto 3000 y el volumen `./data`.

Pasos completos en [docs/INSTALACION.md](./docs/INSTALACION.md).

## Telegram

`server/telegramPoller.ts` arranca siempre y usa `getUpdates` con offset: funciona sin dominio público ni certificado. Comandos del bot: `/start`, `/ayuda`, `/ordenes`, `/actualizar` (solo `TELEGRAM_ADMIN_IDS`), `/nuevaorden`; los mensajes de orden llevan botones `en_cuenta` y `finalizada`. Si prefieres webhook, `POST /api/telegram/set-webhook`; con URL vacía llama a `deleteWebhook`. Webhook y poller no conviven.

## Estructura

```
src/app         router hash, shell, estado global (workspace.tsx)
src/pages       una pantalla por ruta (#/hoy, #/ordenes, #/reportes…)
src/features    UI de órdenes, modales y flujos de dominio
src/ui          primitivas del sistema de diseño (kit.tsx) y estilos base
src/lib         API, helpers, RBAC y configuración compartida
src/services    cola de sincronización offline
server/         Express, Socket.IO, Telegram, persistencia y servicio de IA
deploy/         unidad systemd y Caddyfile
db/             esquema y utilidades de datos
docs/           instalación, Telegram, uso y privacidad
data/           database.json en ejecución (fuera de git)
```

## API principal

| Método y ruta | Uso |
|---|---|
| `GET /api/health`, `GET /api/metrics` | Salud y métricas (públicas) |
| `POST /api/auth/verify` | Login con PIN (pública, 10 req/min) |
| `GET/POST /api/orders` | Listar y crear órdenes |
| `PATCH /api/orders/:id/status` | Cambiar estado |
| `POST /api/orders/:id/notes` | Añadir nota |
| `DELETE /api/orders/:id` | Borrar orden |
| `GET /api/members`, `GET /api/activity` | Equipo e historial |
| `POST /api/sync/fifo` | Sincronizar cola offline |
| `GET /api/realtime/stream` | Eventos en vivo (SSE) |
| `GET /api/persistence/status`, `POST /api/reset-data` | Estado del JSON y reinicio de datos |
| `POST /api/ai/analyze-kpi` | Análisis de KPIs con IA |
| `GET /api/telegram/config`, `POST /api/telegram/test-connection` | Configuración enmascarada y prueba |
| `POST /api/telegram/set-webhook` | Activar o borrar webhook |
| `POST /api/telegram/webhook` | Recepción de updates (pública, con secreto) |
| `POST /api/telegram/send-reminder`, `POST /api/telegram/broadcast`, `POST /api/telegram/sync-members` | Envíos y sincronización de miembros |

No existe `PATCH /api/orders/:id`: las mutaciones son las de la tabla.

## Seguridad

- Todo salvo `/api/health`, `/api/metrics`, `/api/auth/verify` y `/api/telegram/webhook` exige token de sesión HMAC (TTL 12 h).
- Rate limit: 300 req/min en la API, 10 req/min en `/api/auth`.
- Secretos solo en `.env` (ignorado por git). `/api/telegram/config` devuelve el token enmascarado para la interfaz.
- HTTPS obligatorio en producción (Caddy lo resuelve). El cliente no publica sourcemaps.
- Límite conocido: el bundle del servidor se genera con `--sourcemap`, por lo que `dist/server.cjs.map` existe en el servidor. No lo sirvas públicamente (Caddy solo publica la SPA y la API) y no lo distribuyas.

## Documentación

- [Instalación](./docs/INSTALACION.md)
- [Guía de Telegram](./docs/GUIA-TELEGRAM.md)
- [Manual de uso](./docs/USO.md)
- [Privacidad](./docs/PRIVACIDAD.md)
