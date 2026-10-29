# Instalación

NÚCLEO CONTROL es un único proceso Node que sirve la SPA y la API en el mismo puerto.

## Requisitos

- Node.js **22 LTS** (incluye npm 10 o superior).
- Git.
- 512 MB de RAM y 200 MB de disco como mínimo.
- Linux: systemd + Caddy (recomendado) o Docker con `docker compose`.

## Instalación local (5 pasos)

1. Obtén el código y entra en la carpeta:

   ```bash
   git clone <URL_DEL_REPO> control-de-gestion
   cd control-de-gestion
   ```

2. Instala dependencias exactas del `package-lock.json`:

   ```bash
   npm ci
   ```

3. Crea el archivo de entorno y edítalo:

   ```bash
   cp .env.example .env
   ```

   Como mínimo cambia `ADMIN_PIN`, define `AUTH_SECRET` y, si vas a usar Telegram, `TELEGRAM_BOT_TOKEN` y `TELEGRAM_GROUP_CHAT_ID`. Ver [GUIA-TELEGRAM.md](./GUIA-TELEGRAM.md).

4. Arranca en desarrollo:

   ```bash
   npm run dev
   ```

   Todo se sirve en <http://localhost:3000>. **No arranques Vite por separado**: `npm run dev` ejecuta `tsx server.ts`, que monta Vite como middleware.

5. Abre el navegador, introduce el PIN de `ADMIN_PIN` y entra.

Comprobaciones antes de dar por buena la instalación:

```bash
npm run lint    # tsc --noEmit, único check estático del proyecto
npm run build   # vite build + bundle del servidor en dist/server.cjs
npm start       # sirve dist/ (requiere build previo)
```

> En PowerShell `npm run clean` falla porque usa `rm -rf`. Borra `dist/` a mano.

## Instalación en servidor Linux (Debian/Ubuntu) con systemd + Caddy

### 1. Node.js 22

```bash
sudo apt update
sudo apt install -y curl git ufw debian-keyring debian-archive-keyring apt-transport-https
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # debe ser v22.x
```

### 2. Usuario del servicio y código

```bash
sudo useradd --system --home-dir /opt/nucleo --shell /usr/sbin/nologin nucleo
sudo mkdir -p /opt/nucleo
sudo chown nucleo:nucleo /opt/nucleo

sudo -u nucleo git clone <URL_DEL_REPO> /opt/nucleo
cd /opt/nucleo
sudo -u nucleo npm ci
sudo -u nucleo npm run build
sudo -u nucleo mkdir -p /opt/nucleo/data
```

### 3. Variables de entorno

```bash
sudo -u nucleo cp /opt/nucleo/.env.example /opt/nucleo/.env
sudo -u nucleo nano /opt/nucleo/.env
sudo chown nucleo:nucleo /opt/nucleo/.env
sudo chmod 600 /opt/nucleo/.env
```

En producción define siempre `AUTH_SECRET` (por ejemplo `openssl rand -hex 32`), `NODE_ENV=production` y `APP_URL=https://TU_DOMINIO` sin barra final.

### 4. Servicio systemd

```bash
sudo cp /opt/nucleo/deploy/nucleo.service /etc/systemd/system/nucleo.service
sudo systemctl daemon-reload
sudo systemctl enable --now nucleo
sudo systemctl status nucleo
sudo journalctl -u nucleo -f
```

La unidad usa `User=nucleo`, `WorkingDirectory=/opt/nucleo`, `EnvironmentFile=/opt/nucleo/.env`, `ReadWritePaths=/opt/nucleo/data` y `ExecStart=/usr/bin/node /opt/nucleo/dist/server.cjs`. Si cambias la ruta del proyecto, edita también la unidad.

### 5. Caddy (HTTPS automático y SSE sin buffering)

```bash
sudo apt install -y caddy
sudo cp /opt/nucleo/deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile    # sustituye el dominio de ejemplo
sudo systemctl reload caddy
```

El `Caddyfile` incluye `flush_interval -1`, imprescindible para que `/api/realtime/stream` (SSE) entregue los eventos al instante, y hace proxy a `127.0.0.1:3000`.

### 6. Cortafuegos

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

No abras el puerto 3000: Caddy habla con Node por loopback.

## Alternativa: Docker

```bash
cp .env.example .env      # edita los valores
mkdir -p data
docker compose up -d --build
docker compose logs -f
```

El `docker-compose.yml` publica el puerto 3000 y monta `./data` como volumen, de modo que `data/database.json` sobrevive a los reinicios del contenedor. El `Dockerfile` parte de `node:22-alpine` e incluye healthcheck.

## Actualizar una instalación existente

```bash
cd /opt/nucleo
sudo systemctl stop nucleo
sudo -u nucleo git pull --ff-only
sudo -u nucleo npm ci
sudo -u nucleo npm run build
sudo systemctl start nucleo
```

Haz copia de `data/database.json` antes de actualizar.

## Verificación

1. Salud del servicio:

   ```bash
   curl -s https://TU_DOMINIO/api/health
   ```

2. Login con PIN en la web: debe entrar al panel `#/hoy`.

3. Telegram: desde la página `#/telegram`, pulsa la prueba de conexión (equivale a `POST /api/telegram/test-connection`) y envía luego un mensaje de prueba al grupo.

## Copia de seguridad y restauración

El único estado persistente es `data/database.json`. Para una copia consistente, detén el servicio mientras copias:

```bash
sudo systemctl stop nucleo
sudo mkdir -p /var/backups
sudo tar czf /var/backups/nucleo-$(date +%F).tar.gz -C /opt/nucleo data
sudo systemctl start nucleo
```

Restauración:

```bash
sudo systemctl stop nucleo
sudo tar xzf /var/backups/nucleo-2026-10-29.tar.gz -C /opt/nucleo
sudo chown -R nucleo:nucleo /opt/nucleo/data
sudo systemctl start nucleo
```

Programa el `tar` en cron y comprueba al menos una restauración real: una copia que nunca se ha restaurado no es una copia.

## Errores típicos

| Síntoma | Causa | Solución |
|---|---|---|
| `EADDRINUSE` al arrancar | Puerto 3000 ocupado (otra instancia, o un Vite suelto) | `sudo ss -lptn 'sport = :3000'` y mata el proceso; recuerda que no hace falta Vite aparte |
| El servidor ignora `ADMIN_PIN` o el token | `.env` no cargado: falta el archivo, está en otra ruta o systemd no lo apunta | Comprueba `EnvironmentFile=/opt/nucleo/.env` y `journalctl -u nucleo` |
| `npm start` responde 404 o no arranca | No existe `dist/` | `npm run build` antes de `npm start` |
| `EACCES` o `EROFS` al guardar | `data/` sin permisos de escritura para `nucleo` | `sudo chown -R nucleo:nucleo /opt/nucleo/data`; en Docker revisa el volumen |
| El panel no se actualiza en tiempo real | Proxy con buffering: SSE cortado | Añade `flush_interval -1` en Caddy (y desactiva buffering en nginx) |
| `401 Unauthorized` en la API | Token caducado (TTL 12 h) o sesión perdida | Vuelve a iniciar sesión con el PIN |
| `429 Too Many Requests` | Límite de 300 req/min en API o 10 req/min en `/api/auth` | Espera el tiempo de `Retry-After` |
| Telegram no recibe nada | Webhook activo que secuestra los updates | `POST /api/telegram/set-webhook` con URL vacía y reinicia el servicio |
