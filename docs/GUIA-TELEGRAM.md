# Guía de Telegram

Pasos para conectar el bot con el grupo de trabajo. Se hace una sola vez y luego solo se mantiene el token.

## 1. Crear el bot (@BotFather)

1. Abre Telegram y busca **@BotFather** (verifica el check azul).
2. Envía `/newbot`.
3. Elige un nombre visible (por ejemplo `Núcleo Control`) y un usuario terminado en `bot` (por ejemplo `nucleo_control_bot`).
4. BotFather devuelve el **token**, con forma `123456789:AAH...`. Ese valor es `TELEGRAM_BOT_TOKEN`.

Si el token se filtra (captura, chat, repositorio), envíale a BotFather `/revoke` y elige el bot: genera un token nuevo e invalida el anterior. Actualiza `.env` y reinicia el servicio.

## 2. Crear el grupo y añadir el bot como administrador

1. Crea un grupo con el equipo.
2. Añade el bot como miembro.
3. Promociónalo a **administrador** con permiso para enviar mensajes. Sin privilegios de admin algunos grupos no entregan los mensajes del bot y los botones inline fallan.

No hace falta grupo público ni enlace de invitación.

## 3. Obtener `TELEGRAM_GROUP_CHAT_ID`

Los IDs de grupo empiezan por `-100` (los de usuario son positivos). Tres métodos:

- **Método A — `getUpdates`.** Escribe cualquier mensaje en el grupo y consulta:

  ```bash
  curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates"
  ```

  Busca `"chat":{"id":-100...,"type":"group"|"supergroup"}`. Si la respuesta está vacía, escribe otro mensaje y repite: `getUpdates` solo devuelve lo reciente.

- **Método B — reenviar a un bot de datos.** Reenvía un mensaje del grupo a **@userinfobot** o **@RawDataBot**; responden con el `chat.id`.

- **Método C — botón de la app.** En la página `#/telegram` de la aplicación hay un botón que detecta el chat del grupo a partir de los updates recibidos; copia ese ID.

Copia el número completo, con el signo menos. Un ID truncado produce `400 chat not found`.

## 4. Obtener los IDs de usuario para `TELEGRAM_ADMIN_IDS`

`TELEGRAM_ADMIN_IDS` es una lista separada por comas. Admite ID numérico (`123456789`) o usuario con arroba (`@fulano`).

- ID numérico: escribe a **@userinfobot** en privado; responde con tu `id`.
- Usuario: el `@usuario` público de la persona (sin espacios).

Solo esos usuarios pueden ejecutar `/actualizar`. El resto de comandos de consulta funcionan para cualquiera del grupo.

## 5. `ADMIN_PIN` y `AUTH_SECRET`

- `ADMIN_PIN`: el PIN de acceso a la web. Por defecto `123456`; cámbialo antes de exponer el servicio.
- `AUTH_SECRET`: clave con la que se firma el token de sesión (HMAC-SHA256, TTL 12 h). Genérala con:

  ```bash
  openssl rand -hex 32
  ```

  Si falta, el sistema la deriva del PIN y del token y avisa por consola: es aceptable para probar en local, nunca en producción (cambiar el PIN invalidaría las sesiones de forma imprevisible).

## 6. `APP_URL`

URL pública de la aplicación, sin barra final:

```
APP_URL="https://control.midominio.com"
```

Se usa para enlaces y para el webhook. Con barra final se generan rutas dobles (`//api/...`).

## 7. Webhook o poller

El servicio arranca siempre `server/telegramPoller.ts`, que consulta `getUpdates` con offset. No necesita dominio público ni certificado, y es la opción recomendada detrás de un servidor cerrado, en local o tras NAT.

Usa **webhook** solo si quieres entrega inmediata sin sondeo:

```bash
curl -s -X POST https://TU_DOMINIO/api/telegram/set-webhook \
  -H "Authorization: Bearer <TOKEN_DE_SESION>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://TU_DOMINIO/api/telegram/webhook"}'
```

Reglas importantes:

- **Webhook y poller son excluyentes.** Si hay un webhook activo, `getUpdates` devuelve error y el poller no recibe nada.
- Para volver al poller, borra el webhook enviando la URL vacía (la ruta llama a `deleteWebhook`):

  ```bash
  curl -s -X POST https://TU_DOMINIO/api/telegram/set-webhook \
    -H "Authorization: Bearer <TOKEN_DE_SESION>" \
    -H "Content-Type: application/json" \
    -d '{"url":""}'
  ```

  O directamente contra Telegram: `curl -s "https://api.telegram.org/bot<TOKEN>/deleteWebhook"`.
- `/api/telegram/webhook` es una de las pocas rutas públicas (se autentica con secreto propio); el resto de la API exige token de sesión.

## 8. Probar la conexión

1. `POST /api/telegram/test-connection` con el token de sesión:

   ```bash
   curl -s -X POST https://TU_DOMINIO/api/telegram/test-connection \
     -H "Authorization: Bearer <TOKEN_DE_SESION>"
   ```

2. En la app, página `#/telegram`: verifica el estado del bot (se muestra el token **enmascarado**, nunca el real) y envía un mensaje de prueba.
3. En el grupo, envía `/ayuda` y comprueba que responde. Comandos disponibles: `/start`, `/ayuda`, `/ordenes`, `/actualizar`, `/nuevaorden`. Los mensajes de orden llevan botones inline `en_cuenta` y `finalizada`.

## 9. Errores típicos de Telegram

| Error | Significado | Solución |
|---|---|---|
| `401 Unauthorized` | Token inválido o revocado | Copia el token completo de BotFather, sin espacios; si lo revocaste, actualiza `.env` |
| `400 Bad Request: chat not found` | `TELEGRAM_GROUP_CHAT_ID` incorrecto o el bot no está en ese grupo | Revisa el signo menos y el prefijo `-100`; añade el bot al grupo |
| `403 Forbidden: bot is not a member of the group chat` | El bot fue expulsado o el grupo cambió | Vuelve a añadir el bot y hazlo admin |
| `403 Forbidden: not enough rights` | El bot no puede escribir | Promociónalo a administrador con permiso de envío |
| `409 Conflict` | Webhook y poller compitiendo | Borra el webhook (`deleteWebhook`) o deja de usar el poller; reinicia |
| El grupo no responde a comandos | Privacidad del bot: en grupos solo ve mensajes que lo mencionan | BotFather → `/setprivacy` → `Disable`, o hazlo admin |
| `429 Too Many Requests` | Límite de la API de Telegram o límite local (300 req/min) | Espera y reintenta; en el bot revisa `Retry-After` |
| IDs de admin ignorados | `TELEGRAM_ADMIN_IDS` con espacios o punto y coma | Separa con comas, sin espacios |

## 10. Seguridad del token

- El token da control total del bot: no lo pegues en issues, capturas ni chats. Vive solo en `.env` (ignorado por git) con permisos `600`.
- La API expone `/api/telegram/config`; devuelve `tokenMasked` y `hasToken` para la interfaz. No lo vuelques en logs propios.
- Los logs del servicio no deben contener el token: revisa `journalctl -u nucleo` si sospechas.
- Si el grupo es sensible, limita la audiencia del bot y revisa quién es administrador del grupo: cualquiera con permisos puede expulsar al bot y cortar las notificaciones.
