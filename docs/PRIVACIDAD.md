# Privacidad (aviso operativo de uso interno)

Este documento describe qué datos maneja la instalación de NÚCLEO CONTROL y qué sale del servidor. Es un aviso **operativo** para el equipo que la usa, no un documento legal publicado.

## Qué se guarda

- **Órdenes**: título, descripción, estado, prioridad, departamento, responsable, fechas y notas.
- **Integrantes**: nombre, rol y departamento.
- **Actividad y auditoría**: qué cambió, quién y cuándo.
- **Telegram**: identificadores de chat y de usuario necesarios para enviar mensajes y reconocer administradores.
- **Sesión**: token firmado en el navegador; el servidor solo guarda la clave de firma en `.env`.

No hay cuentas con contraseña ni correo: la única credencial es el PIN compartido.

## Dónde

Todo el estado vive en un archivo JSON: `data/database.json`, gestionado por `DualPersistenceManager`.

- Está **fuera de git**: `.gitignore` excluye `data/*.json`.
- En systemd, el servicio solo puede escribir en `/opt/nucleo/data`; en Docker, en el volumen `./data`.
- Protege el archivo como cualquier base de datos: permisos del usuario del servicio y copias de seguridad cifradas si el contenido lo requiere.
- No edites el archivo con el servidor en marcha: la instancia en memoria lo sobrescribe.

## Quién accede

- Acceso a la web con PIN → token HMAC-SHA256 con caducidad de 12 h. Sin token, la API responde `401`; solo quedan públicas `/api/health`, `/api/metrics`, `/api/auth/verify` y `/api/telegram/webhook`.
- `/api/auth` está limitada a 10 peticiones por minuto y el resto de la API a 300 por minuto, para frenar intentos de fuerza bruta sobre el PIN.
- El token de Telegram permite controlar el bot: quien lo tenga puede leer y escribir en el grupo.
- Los roles `developer`, `admin`, `operator` y `viewer` filtran la interfaz. El rol `operator` no tiene acceso web.

## Conservación

No hay caducidad automática de datos: se conservan hasta que se borran. Decide un periodo (por ejemplo, un año de órdenes cerradas) y límpialo de forma periódica; si guardas datos de clientes, la minimización es obligatoria, no opcional.

## Cómo borrar

- **Desde la app**: `POST /api/reset-data` vacía el estado gestionado. Es irreversible: haz copia antes.
- **Manualmente**, con el servidor parado:

  ```bash
  sudo systemctl stop nucleo
  sudo rm /opt/nucleo/data/database.json
  sudo systemctl start nucleo
  ```

  El servicio recrea el archivo vacío al arrancar.

- Para eliminar el acceso de una persona: quítala de `TELEGRAM_ADMIN_IDS`, retira su usuario de Telegram del grupo y cambia `ADMIN_PIN` si compartía el PIN.

## Qué sale del servidor

**Telegram** (servidores de Telegram): títulos de orden, estados, prioridades, responsable y el texto de notas o comunicados que se envíen al grupo, más el ID del chat. Todo lo que se envía al grupo lo ven sus miembros.

**Google Gemini** (servidores de Google): cuando se pulsa el análisis de KPIs, `server/kpiAiService.ts` usa el modelo `gemini-3.8-flash` y envía los agregados de KPIs **más la carga por integrante con su `name` y su `role`, y el conteo por departamento**. Es decir, **salen nombres reales de personas**, además de la estructura del equipo. No se envían descripciones de órdenes ni notas. Si el equipo no debe salir de la infraestructura, no uses ese análisis o cambia el servicio para enviar datos agregados y anonimizados.

**Caddy**: los registros de acceso del proxy contienen IP y ruta. Configura la retención y evita registrar cuerpos de petición.

## Buenas prácticas mínimas

- Un PIN por equipo, cambiado cuando alguien sale. `ADMIN_PIN` por defecto es `123456`: nunca en producción.
- `AUTH_SECRET` propio en producción (`openssl rand -hex 32`).
- HTTPS obligatorio: el PIN y el token viajan en cada petición.
- Copias de seguridad en un destino con acceso restringido.

---

Aviso operativo de uso interno. No sustituye la revisión legal ni la información al interesado que corresponda según el tratamiento real de datos personales.
