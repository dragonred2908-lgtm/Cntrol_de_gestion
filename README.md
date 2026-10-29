# NÚCLEO CONTROL — Centro de Operaciones

Sistema de control, despacho y seguimiento en tiempo real de órdenes de trabajo por áreas de responsabilidad, con integración bidireccional a Telegram y sincronización multi-dispositivo.

> **v3.0 — Rediseño integral de la interfaz.** La app pasó de una pantalla única con ventanas en cascada a un **centro de operaciones con navegación por páginas**: bandeja "Hoy", tablero kanban, detalle de orden, equipo, Telegram, reportes, auditoría y ajustes. El backend Express y la integración con Telegram se mantienen.

---

## ⚡ Qué hace

- **Ciclo de vida de órdenes:** `Recibida → En cuenta → En proceso → Finalizada`, con prioridades, vencimientos, notas y recordatorios.
- **Tablero operativo:** kanban por estado con drag & drop, vista lista, filtros por prioridad, responsable y vencidas.
- **Bandeja "Hoy":** prioriza lo urgente y vencido, muestra carga del equipo y actividad reciente.
- **Detalle de orden:** stepper de estado, ficha completa, notas con autor y fecha, historial auditable.
- **Telegram:** despacho automático al responsable o grupo, botones inline, recordatorios masivos e individuales, comunicados.
- **Tiempo real:** WebSockets (Socket.IO) + Server-Sent Events con reconexión, presencia multi-dispositivo y cola FIFO offline.
- **Reportes:** exportación Excel/PDF y diagnóstico de KPIs asistido por Gemini.
- **RBAC:** permisos efectivos por rol en la interfaz y validación de PIN en el servidor.

---

## 📁 Estructura

```text
├── src/
│   ├── app/
│   │   ├── AppShell.tsx      # Sidebar, topbar, buscador global, toasts
│   │   ├── router.tsx        # Router por hash (#/hoy, #/ordenes…)
│   │   └── workspace.tsx     # Estado global, realtime y acciones
│   ├── pages/
│   │   ├── TodayPage.tsx
│   │   ├── OrdersPage.tsx
│   │   ├── OrderDetailPage.tsx
│   │   ├── TeamPage.tsx
│   │   ├── TelegramPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── AuditPage.tsx
│   │   └── SettingsPage.tsx
│   ├── ui/kit.tsx            # Sistema de componentes (botones, cards, modales…)
│   ├── features/             # Cards de orden, stepper, modales de alta/recordatorio
│   ├── lib/                  # API tipada, helpers, RBAC, exportadores
│   ├── hooks/                # useSSE, useMirrorSync, useDualPersistence
│   ├── services/syncQueue.ts # Cola FIFO offline
│   ├── index.css             # Design tokens + estilos base
│   └── App.tsx               # Composición de la app
├── server/
│   ├── app.ts                # API REST (/api/*)
│   ├── init.ts               # Estado y persistencia
│   ├── dualPersistence.ts    # Persistencia local + resolución de conflictos
│   ├── telegramController.ts # Bot, callbacks y webhooks
│   ├── telegramPoller.ts     # Polling en segundo plano
│   ├── sseManager.ts         # Canal SSE con heartbeat
│   └── socketHandlers.ts     # Eventos Socket.IO
├── server.ts                 # Bootstrap (Express + Vite + Socket.IO)
└── data/database.json        # Base local persistente
```

---

## 🚀 Puesta en marcha

**Requisitos:** Node.js ≥ 18, npm ≥ 9.

```bash
npm install
cp .env.example .env    # completar variables
npm run dev             # http://localhost:3000
```

Variables de entorno:

```env
GEMINI_API_KEY="..."
APP_URL="http://localhost:3000"
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_GROUP_CHAT_ID="-100..."
ADMIN_PIN="123456"
```

Producción:

```bash
npm run build
npm start
```

Verificación de tipos:

```bash
npm run lint
```

---

## 🧭 Rutas de la interfaz

| Ruta | Pantalla |
| --- | --- |
| `#/hoy` | Bandeja operativa y KPIs |
| `#/ordenes` | Tablero kanban / lista |
| `#/ordenes/:id` | Detalle de orden |
| `#/equipo` | Integrantes y carga de trabajo |
| `#/telegram` | Bot, grupo, recordatorios y comunicados |
| `#/reportes` | Exportación y análisis IA |
| `#/auditoria` | Historial de eventos |
| `#/ajustes` | Sesión, infraestructura y datos |

---

## 🔌 API principal

| Método | Endpoint | Uso |
| --- | --- | --- |
| `GET` | `/api/orders` | Listado de órdenes |
| `POST` | `/api/orders` | Crear orden y despachar por Telegram |
| `PATCH` | `/api/orders/:id/status` | Cambiar estado |
| `POST` | `/api/orders/:id/notes` | Agregar nota |
| `DELETE` | `/api/orders/:id` | Eliminar orden |
| `GET/POST` | `/api/members` | Equipo |
| `GET` | `/api/activity` | Auditoría |
| `GET/POST` | `/api/telegram/config` | Configuración del bot |
| `POST` | `/api/telegram/test-connection` | Probar token y grupo |
| `POST` | `/api/telegram/send-reminder` | Recordatorio individual o masivo |
| `POST` | `/api/telegram/broadcast` | Comunicado al grupo |
| `POST` | `/api/ai/analyze-kpi` | Diagnóstico con Gemini |
| `GET` | `/api/realtime/stream` | SSE en tiempo real |
| `POST` | `/api/sync/fifo` | Sincronización offline |

> La UI consume `PATCH /api/orders/:id/status` y `POST /api/orders/:id/notes`, que son los endpoints reales del backend. La versión anterior llamaba a rutas inexistentes y los cambios fallaban en silencio.

---

## 🛡️ Roles

| Rol | Acceso web | Órdenes | Telegram | Reportes | Reset |
| --- | --- | --- | --- | --- | --- |
| Administrador | ✅ | ✅ | ✅ | ✅ | — |
| Desarrollo | ✅ | ✅ | ✅ | ✅ | ✅ |
| Observador | ✅ | Solo lectura | — | Solo lectura | — |
| Operador | ❌ (solo Telegram) | Botones inline | — | — | — |

El PIN se valida en `/api/auth/verify`. La sesión se conserva en `localStorage`.

---

## 📄 Licencia

Apache 2.0 — ver `LICENSE`.
