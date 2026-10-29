# AGENTS.md

## Project

Single-package app (no monorepo): **NÚCLEO CONTROL / Control de Gestión**. React 19 + Vite + Tailwind v4 frontend; Express + Socket.IO backend in `server/`, bootstrapped by `server.ts`. In production one Node process serves the SPA and the API.

## Commands (verified)

- `npm run dev` — one server at `http://localhost:3000` (`tsx server.ts` with Vite middleware). Do not start Vite separately; `PORT` comes from `server/config.ts` (default 3000).
- `npm run lint` — `tsc --noEmit`. This is the only static check: there is no ESLint, test runner or CI workflow.
- `npm run build` — `vite build` into `dist/`, then esbuild bundles `server.ts` into `dist/server.cjs` (~3–4 min; a >500 kB chunk warning is expected).
- `npm start` — serves `dist/`; build first.
- Use **npm** (`package-lock.json`). A stale `bun.lock` exists; ignore it.
- The repo is developed on Windows/PowerShell: `npm run clean` uses `rm -rf` and fails there — delete `dist/` manually.

## Frontend architecture (`src/`)

- Flow: `src/main.tsx` → `src/App.tsx` → `WorkspaceProvider` → `AppShell` + page switch.
- Navigation is a **custom hash router** in `src/app/router.tsx` (`#/hoy`, `#/ordenes`, `#/ordenes/:id`, `#/equipo`, `#/telegram`, `#/reportes`, `#/auditoria`, `#/ajustes`). Do not add react-router.
- Adding a page requires three edits: `parseRoute` in `src/app/router.tsx`, the `Pages` switch in `src/App.tsx`, and `NAV` in `src/app/AppShell.tsx`.
- All state and mutations live in `src/app/workspace.tsx` (orders, members, activity, Telegram, session, realtime, toasts). Pages must call its actions instead of ad-hoc `fetch`, so optimistic updates and the offline FIFO queue keep working.
- Design system: primitives in `src/ui/kit.tsx`, tokens/base/component classes in `src/index.css`, order UI in `src/features/order-ui.tsx`, dialogs in `src/features/modals.tsx`.
- Styling: Tailwind v4 utilities + CSS variables (`var(--panel)`, `var(--txt-2)`, `var(--accent)`…). Reuse `.card`, `.btn`, `.badge`, `.input`, `.kanban-col`. No raw hex colors, no new UI/CSS libraries. Icons come from **lucide-react** (Material Symbols belong to the legacy UI).
- `src/components/` is the old single-screen/cascade UI. It is no longer imported by the app but is still typechecked. Do not import it into new code or copy its hardcoded-hex patterns.
- Verify both layouts: desktop sidebar (collapsible) and mobile (drawer + list view).
- UI copy, dates and formatting are Spanish (`es-ES`); use helpers in `src/lib/helpers.ts`. Keep canonical keys: status `recibida | en_cuenta | en_proceso | finalizada`, priority `baja | media | alta | urgente`.

## Data & API contract (common mistakes)

- Client: `src/lib/api.ts`; real routes: `server/app.ts`.
- Order mutations are `PATCH /api/orders/:id/status`, `POST /api/orders/:id/notes` and `DELETE /api/orders/:id`. **There is no `PATCH /api/orders/:id`** (the old UI called it and failed silently).
- `src/types.ts` is shared with the backend (`../src/types.js`). Changing `Order` impacts UI, Express and Telegram payload builders.
- Backend state is the singleton `state.db` in `server/init.ts`. After mutating it, call `saveDatabase(...)` and broadcast with both `io.emit('mirror:*')` and `sseManager.broadcast(...)`.
- Realtime: Socket.IO `mirror:*` events + SSE `/api/realtime/stream`; offline queue in `src/services/syncQueue.ts` → `POST /api/sync/fifo`.
- Persistence is `data/database.json` via `DualPersistenceManager`; the running server overwrites it, so don't hand-edit it while the server runs. The file is tracked in git.
- RBAC (`src/lib/rbacConfig.ts`) is **UI-only**: the REST API has no auth middleware (only the Telegram webhook uses a secret). Don't describe endpoints as protected.
- `GET /api/telegram/config` returns the **full** `botToken` in addition to `tokenMasked`/`hasToken`. Never render or log the token; show `tokenMasked`.
- The UI auto-authenticates as admin using `localStorage` key `nucleo_session_v2`; use Ajustes → “Cerrar sesión” to reach `AuthScreen`.

## Setup

Copy `.env.example` to `.env` (`.env*` is gitignored except the example). Variables: `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_CHAT_ID`, `ADMIN_PIN`, `APP_URL`; defaults in `server/config.ts`. Never commit secrets — `data/database.json` currently contains a real-looking bot token.
