# Guía de Contribución • NÚCLEO CONTROL

¡Gracias por tu interés en contribuir a **NÚCLEO CONTROL (Control de Gestión)**!

## 1. Código de Conducta
Mantenemos un ambiente técnico colaborativo, profesional y respetuoso. Cualquier contribución debe adherirse a las mejores prácticas de ingeniería de software.

## 2. Flujo de Desarrollo y Ramas
- Rama principal: `main`
- Ramas de características: `feature/nombre-de-la-funcionalidad`
- Ramas de corrección: `fix/descripcion-del-bug`
- Ramas de refactorización: `refactor/nombre-del-modulo`

### Pasos recomendados:
1. Crear una rama desde `main`:
   ```bash
   git checkout -b feature/mi-nueva-funcion
   ```
2. Realizar cambios con commits claros y atómicos siguiendo Conventional Commits:
   - `feat(...)`: Nueva funcionalidad
   - `fix(...)`: Corrección de bug
   - `refactor(...)`: Reestructuración sin cambio de funcionalidad
   - `docs(...)`: Cambios en documentación
3. Verificar tipos e integridad antes de solicitar revisión:
   ```bash
   npm run lint
   ```
4. Abrir un Pull Request detallando los cambios introducidos.

## 3. Arquitectura del Servidor Modular
El servidor se divide en capas de responsabilidad única:
- `server/config.ts`: Variables de entorno, lectura con `dotenv` y aserciones.
- `server/init.ts`: Estado central (`state.db`), persistencia dual y controladores.
- `server/socket.ts`: Fábrica de Socket.io y servidor HTTP.
- `server/socketHandlers.ts`: Eventos en tiempo real para sincronización espejo.
- `server/app.ts`: Aplicación Express con todas las rutas RESTful (`/api/*`).
- `server/telegramPoller.ts`: Long-poller en segundo plano para Telegram Bot API.
- `server.ts`: Bootstrap y punto de entrada que ensambla la aplicación.

## 4. Licencia
Al contribuir, aceptas que tus aportes se distribuyan bajo los términos de la licencia **Apache 2.0**.
