# NÚCLEO CONTROL • Sistema de Control y Gestión de Tareas

Plataforma de misión crítica para el control, despacho y seguimiento en tiempo real de órdenes de trabajo por áreas de responsabilidad con integración bidireccional a Telegram Bot API y sincronización espejo multi-dispositivo.

---

## ⚡ Características Principales

- **Gestión de Órdenes:** Ciclo de vida completo (`Recibida` ➔ `En Cuenta` ➔ `En Proceso` ➔ `Finalizada`) con prioridades, temporizadores regresivos y notas técnicas.
- **Sincronización Espejo (Mirror Sync):** Comunicación en tiempo real con WebSockets (`Socket.IO`) y Server-Sent Events (`SSE`) con reconexión automática.
- **Integración con Telegram:** Bot interactivo con inline buttons (`En Cuenta`, `En Proceso`, `Finalizada`), notificaciones push y comandos (`/nuevaorden`, `/ordenes`, `/estado`, `/ayuda`).
- **Arquitectura Modular de Backend:** Servidor Express desacoplado en módulos especializados (`config`, `init`, `app`, `socket`, `socketHandlers`, `telegramPoller`).
- **Persistencia Dual Resiliente:** Soporte primario y respaldo local JSON con cola FIFO contra desconexiones offline.
- **Análisis de KPIs con IA:** Diagnóstico predictivo asistido por modelos de Google Gemini.
- **Exportación Corporativa:** Descarga de reportes ejecutivos estructurados en Excel (.xlsx) y PDF profesional con tablas.

---

## 📁 Estructura del Proyecto

```text
├── server/
│   ├── app.ts               # Aplicación Express y rutas REST (/api/*)
│   ├── config.ts            # Configuración de entorno y validación de variables
│   ├── dualPersistence.ts   # Manejador de persistencia dual y cola FIFO
│   ├── init.ts              # Inicialización de estado y base de datos
│   ├── kpiAiService.ts       # Integración con Gemini para análisis de KPIs
│   ├── socket.ts            # Fábrica de Socket.io y servidor HTTP
│   ├── socketHandlers.ts    # Manejadores de eventos de sockets y presencia
│   ├── sseManager.ts        # Canal de Server-Sent Events con heartbeat
│   ├── telegramController.ts# Lógica de bots, callbacks y webhooks de Telegram
│   └── telegramPoller.ts    # Poller en segundo plano para Telegram Bot API
├── server.ts                # Bootstrap principal y orquestador del servidor
├── src/
│   ├── components/          # Componentes de React (UI Mission Control Dark)
│   ├── hooks/               # Custom hooks (useMirrorSync, useSSE, useDualPersistence)
│   ├── lib/                 # Utilidades de exportación y RBAC
│   ├── services/            # Cola de sincronización FIFO del cliente
│   ├── App.tsx              # Componente raíz
│   └── main.tsx             # Punto de entrada de React
├── data/
│   └── database.json        # Base de datos local persistente
├── package.json             # Dependencias y scripts de ejecución
├── CONTRIBUTING.md          # Guía para contribuyentes
└── LICENSE                  # Licencia Apache 2.0
```

---

## 🚀 Instalación y Puesta en Marcha

### 1. Prerrequisitos
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### 2. Configurar Variables de Entorno
Copia el archivo de ejemplo y completa los valores requeridos:
```bash
cp .env.example .env
```

Variables disponibles:
```env
GEMINI_API_KEY="tu_api_key_de_gemini"
APP_URL="http://localhost:3000"
TELEGRAM_BOT_TOKEN="tu_token_de_botfather"
TELEGRAM_GROUP_CHAT_ID="-1001234567890"
ADMIN_PIN="123456"
```

### 3. Instalar Dependencias
```bash
npm install
```

### 4. Modo Desarrollo
Inicia el servidor modular con recarga rápida de Vite:
```bash
npm run dev
```
Accede a la interfaz en `http://localhost:3000`.

### 5. Compilación y Producción
```bash
npm run build
npm start
```

---

## 🛡️ Control de Acceso y Seguridad
- **PIN Administrador:** `123456` (o `1234`)
- **Roles:** `Administrador`, `Desarrollo`, `Operador de Campo`, `Observador (Viewer)`.

---

## 📄 Licencia
Distribuido bajo la Licencia **Apache 2.0**. Consulta el archivo `LICENSE` para más información.
